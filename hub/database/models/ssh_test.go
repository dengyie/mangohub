package models

import (
	"strings"
	"testing"
)

func TestGenerateAndParseEd25519Keypair(t *testing.T) {
	pub, priv, fp, err := GenerateEd25519Keypair("test-key")
	if err != nil {
		t.Fatalf("GenerateEd25519Keypair failed: %v", err)
	}

	if !strings.HasPrefix(pub, "ssh-ed25519 ") {
		t.Fatalf("Expected ssh-ed25519 prefix, got: %s", pub)
	}
	if !strings.HasSuffix(pub, " test-key") {
		t.Fatalf("Expected comment 'test-key', got: %s", pub)
	}
	if !strings.HasPrefix(fp, "SHA256:") {
		t.Fatalf("Expected fingerprint SHA256:, got: %s", fp)
	}
	if !strings.Contains(priv, "BEGIN OPENSSH PRIVATE KEY") {
		t.Fatalf("Expected OpenSSH private key PEM, got: %s", priv)
	}

	norm, fp2, err := ParseSSHPublicKey(pub)
	if err != nil {
		t.Fatalf("ParseSSHPublicKey failed: %v", err)
	}
	if norm != pub {
		t.Fatalf("Normalized pubkey mismatch: %q vs %q", norm, pub)
	}
	if fp2 != fp {
		t.Fatalf("Fingerprint mismatch: %q vs %q", fp2, fp)
	}
}
