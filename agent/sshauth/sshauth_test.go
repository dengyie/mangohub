package sshauth

import (
	"fmt"
	"os"
	"os/user"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"
)

func TestAtomicWriteAndRevokeKey(t *testing.T) {
	tmpDir := t.TempDir()
	authPath := filepath.Join(tmpDir, "authorized_keys")

	// 初始写入已有 key
	existingKey := "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAExistingAdminKey admin@host"
	if err := writeAuthorizedKeysAtomic(authPath, []byte(existingKey+"\n"), ""); err != nil {
		t.Fatalf("atomic write existing: %v", err)
	}

	ticketID := "test-ticket-12345"
	newKey := "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAFreshGrantedKey granted@guest"
	exp := time.Now().Add(10 * time.Minute)

	// 正规格式：EXP:<unix_number>
	tagLine := fmt.Sprintf("%s%s EXP:%d", leaseTagPrefix, ticketID, exp.Unix())
	lines := []string{existingKey, tagLine, newKey}
	if err := writeAuthorizedKeysAtomic(authPath, []byte(strings.Join(lines, "\n")+"\n"), ""); err != nil {
		t.Fatalf("atomic write with lease: %v", err)
	}

	content, err := os.ReadFile(authPath)
	if err != nil || !strings.Contains(string(content), newKey) {
		t.Fatalf("Expected newKey present: %v", err)
	}

	// 执行注销
	leaseMu.Lock()
	err = removeKeyByTicketLocked(authPath, ticketID, "")
	leaseMu.Unlock()
	if err != nil {
		t.Fatalf("removeKeyByTicketLocked failed: %v", err)
	}

	contentAfter, _ := os.ReadFile(authPath)
	strAfter := string(contentAfter)
	if strings.Contains(strAfter, newKey) {
		t.Fatalf("newKey should have been removed after revoke")
	}
	if strings.Contains(strAfter, ticketID) {
		t.Fatalf("ticket tag should have been removed after revoke")
	}
	if !strings.Contains(strAfter, existingKey) {
		t.Fatalf("existingKey should have been preserved!")
	}
}

func TestReconcileLeases(t *testing.T) {
	tmpDir := t.TempDir()
	authPath := filepath.Join(tmpDir, "authorized_keys")

	adminKey := "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAAdmin admin@internal"

	// 构造三个租约场景：
	// 1. 已过期的 ticket 1
	// 2. 依然有效的 ticket 2
	// 3. 普通管理员 key
	expPast := time.Now().Add(-10 * time.Minute).Unix()
	expFuture := time.Now().Add(30 * time.Minute).Unix()

	lines := []string{
		adminKey,
		fmt.Sprintf("%sstale-ticket EXP:%d", leaseTagPrefix, expPast),
		"ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAStaleKey guest@stale",
		fmt.Sprintf("%sactive-ticket EXP:%d", leaseTagPrefix, expFuture),
		"ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAActiveKey guest@active",
	}
	_ = writeAuthorizedKeysAtomic(authPath, []byte(strings.Join(lines, "\n")+"\n"), "")

	// 直接调用真正的 reconcileLeasesAtPath 测试真实业务逻辑！
	cleaned, err := reconcileLeasesAtPath(authPath, "")
	if err != nil {
		t.Fatalf("reconcileLeasesAtPath failed: %v", err)
	}
	if cleaned != 1 {
		t.Fatalf("Expected 1 cleaned, got %d", cleaned)
	}

	finalContent, err := os.ReadFile(authPath)
	if err != nil {
		t.Fatalf("read finalContent failed: %v", err)
	}
	strFinal := string(finalContent)
	if strings.Contains(strFinal, "StaleKey") {
		t.Fatalf("StaleKey was not purged!")
	}
	if strings.Contains(strFinal, "stale-ticket") {
		t.Fatalf("stale-ticket tag was not purged!")
	}
	if !strings.Contains(strFinal, "ActiveKey") {
		t.Fatalf("ActiveKey was wrongly purged!")
	}
	if !strings.Contains(strFinal, "active-ticket") {
		t.Fatalf("active-ticket tag was wrongly purged!")
	}
	if !strings.Contains(strFinal, adminKey) {
		t.Fatalf("adminKey was wrongly purged!")
	}
}

// 显式指定的目标用户必须真实存在：查无此人时报错而不是静默回落到
// agent 当前用户（生产中为 root）的 authorized_keys。
func TestResolveAuthorizedKeysPathUnknownUserErrors(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("windows 分支忽略 targetUsername，见 ResolveAuthorizedKeysPath 注释")
	}
	if _, err := user.Lookup("mangohub-definitely-missing-user"); err == nil {
		t.Skip("测试环境意外存在该用户")
	}
	if _, err := ResolveAuthorizedKeysPath("mangohub-definitely-missing-user"); err == nil {
		t.Fatalf("unknown explicit targetUser must return an error, not fall back")
	}
	// 空值仍允许回落到当前运行账户
	if p, err := ResolveAuthorizedKeysPath(""); err != nil || p == "" {
		t.Fatalf("empty targetUser should fall back to current user, got %q, %v", p, err)
	}
}

func TestAuthorizeKeyRejectsMultilineAndWhitespace(t *testing.T) {
	validTicket := "valid-ticket-123"
	validKey := "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAValidKey user@example"
	exp := time.Now().Add(10 * time.Minute)

	// Multiline key
	err := AuthorizeKey(validTicket, validKey+"\nssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC...", "", exp)
	if err == nil {
		t.Fatal("expected error for multiline public key injection")
	}

	// Multiline ticket
	err = AuthorizeKey("ticket\ninjection", validKey, "", exp)
	if err == nil {
		t.Fatal("expected error for newline in ticketID")
	}

	// Whitespace in ticket
	err = AuthorizeKey("ticket with spaces", validKey, "", exp)
	if err == nil {
		t.Fatal("expected error for whitespace in ticketID")
	}
}

func TestRevokeKeyWithInterleavedBlankLines(t *testing.T) {
	tmpDir := t.TempDir()
	authPath := filepath.Join(tmpDir, "authorized_keys")

	existingKey := "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAAdmin admin@host"
	ticketID := "blank-line-ticket"
	targetKey := "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAATargetKey guest@host"

	// Construct file with blank lines between tag and key
	lines := []string{
		existingKey,
		"",
		fmt.Sprintf("%s%s EXP:%d", leaseTagPrefix, ticketID, time.Now().Add(10*time.Minute).Unix()),
		"", // Blank line between tag and key!
		targetKey,
		"",
	}
	if err := writeAuthorizedKeysAtomic(authPath, []byte(strings.Join(lines, "\n")), ""); err != nil {
		t.Fatal(err)
	}

	leaseMu.Lock()
	err := removeKeyByTicketLocked(authPath, ticketID, "")
	leaseMu.Unlock()
	if err != nil {
		t.Fatal(err)
	}

	content, err := os.ReadFile(authPath)
	if err != nil {
		t.Fatal(err)
	}
	strContent := string(content)
	if strings.Contains(strContent, targetKey) {
		t.Fatal("targetKey should have been removed even when separated by a blank line!")
	}
	if strings.Contains(strContent, ticketID) {
		t.Fatal("ticket tag should have been removed!")
	}
	if !strings.Contains(strContent, existingKey) {
		t.Fatal("existingKey should have been preserved!")
	}
}

func TestReconcileLeasesWithInterleavedBlankLines(t *testing.T) {
	tmpDir := t.TempDir()
	authPath := filepath.Join(tmpDir, "authorized_keys")

	existingKey := "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAAdmin admin@host"
	staleTicket := "stale-with-blanks"
	staleKey := "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAStaleKey guest@host"

	lines := []string{
		existingKey,
		fmt.Sprintf("%s%s EXP:%d", leaseTagPrefix, staleTicket, time.Now().Add(-10*time.Minute).Unix()),
		"", // Blank line!
		staleKey,
	}
	if err := writeAuthorizedKeysAtomic(authPath, []byte(strings.Join(lines, "\n")), ""); err != nil {
		t.Fatal(err)
	}

	cleaned, err := reconcileLeasesAtPath(authPath, "")
	if err != nil {
		t.Fatal(err)
	}
	if cleaned != 1 {
		t.Fatalf("expected 1 cleaned lease, got %d", cleaned)
	}

	content, err := os.ReadFile(authPath)
	if err != nil {
		t.Fatal(err)
	}
	strContent := string(content)
	if strings.Contains(strContent, staleKey) {
		t.Fatal("staleKey should have been pruned despite interleaved blank line!")
	}
	if !strings.Contains(strContent, existingKey) {
		t.Fatal("existingKey should have been preserved!")
	}
}
