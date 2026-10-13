//go:build windows

package sshauth

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

func setFileOwner(path string, uid, gid int) error {
	return nil
}

func getTargetOwnership(authPath, targetUser string) (int, int) {
	return -1, -1
}

// hardenAuthorizedKeysACL 收紧 authorized_keys 的 ACL：
// 去掉继承并仅保留 SYSTEM 与 Administrators 完全控制，
// 否则 Win32-OpenSSH 的严格校验会拒绝读取整个文件（含管理员路径的 administrators_authorized_keys）。
func hardenAuthorizedKeysACL(path string) error {
	// 服务上下文的 PATH 可能被裁剪，用绝对路径调用
	icacls := filepath.Join(os.Getenv("SystemRoot"), "System32", "icacls.exe")
	if _, err := os.Stat(icacls); err != nil {
		icacls = "icacls"
	}
	cmd := exec.Command(icacls, path, "/inheritance:r", "/grant", "SYSTEM:(F)", "/grant", "Administrators:(F)")
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("icacls harden %s: %w: %s", path, err, string(out))
	}
	return nil
}
