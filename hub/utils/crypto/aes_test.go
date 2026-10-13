package crypto

import "testing"

func TestEncryptDecrypt(t *testing.T) {
	SetMasterKey("test-secret-key-12345")
	orig := "-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAA...\n-----END OPENSSH PRIVATE KEY-----"

	enc, err := EncryptText(orig)
	if err != nil {
		t.Fatalf("EncryptText failed: %v", err)
	}
	if enc == orig {
		t.Fatalf("EncryptText did not encrypt text")
	}

	dec, err := DecryptText(enc)
	if err != nil {
		t.Fatalf("DecryptText failed: %v", err)
	}
	if dec != orig {
		t.Fatalf("Decrypted text does not match original: got %q, want %q", dec, orig)
	}
}
