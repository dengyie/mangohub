package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"os"
	"sync"

	"golang.org/x/crypto/pbkdf2"
)

var (
	keyMu        sync.RWMutex
	cachedKey    []byte
	fixedSaltKey = []byte("mangohub:vault:kdf:salt:v1")
)

// getMasterKey 返回用于 AES-256-GCM 的 32 字节密钥。
// 优先使用环境变量 MANGOHUB_SECRET_KEY，使用 PBKDF2 进行派生并加读写锁保护。
func getMasterKey() []byte {
	keyMu.RLock()
	if len(cachedKey) == 32 {
		k := make([]byte, 32)
		copy(k, cachedKey)
		keyMu.RUnlock()
		return k
	}
	keyMu.RUnlock()

	keyMu.Lock()
	defer keyMu.Unlock()

	if len(cachedKey) == 32 {
		k := make([]byte, 32)
		copy(k, cachedKey)
		return k
	}

	secret := os.Getenv("MANGOHUB_SECRET_KEY")
	if secret == "" {
		host, _ := os.Hostname()
		secret = "mangohub-internal-default-vault-key:" + host
	}

	derived := pbkdf2.Key([]byte(secret), fixedSaltKey, 10000, 32, sha256.New)
	cachedKey = derived

	k := make([]byte, 32)
	copy(k, cachedKey)
	return k
}

// SetMasterKey 显式设置主密钥（线程安全，供测试或安全配置初始化使用）。
func SetMasterKey(key string) {
	keyMu.Lock()
	defer keyMu.Unlock()
	derived := pbkdf2.Key([]byte(key), fixedSaltKey, 10000, 32, sha256.New)
	cachedKey = derived
}

// EncryptText 使用 AES-256-GCM 加密明文字符串，返回 base64 编码的密文（包含 nonce）。
func EncryptText(plainText string) (string, error) {
	if plainText == "" {
		return "", nil
	}
	key := getMasterKey()
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("create gcm: %w", err)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("generate nonce: %w", err)
	}

	cipherBytes := gcm.Seal(nonce, nonce, []byte(plainText), nil)
	return base64.StdEncoding.EncodeToString(cipherBytes), nil
}

// DecryptText 解密由 EncryptText 生成的 base64 密文字符串。
func DecryptText(cipherBase64 string) (string, error) {
	if cipherBase64 == "" {
		return "", nil
	}
	cipherBytes, err := base64.StdEncoding.DecodeString(cipherBase64)
	if err != nil {
		return "", fmt.Errorf("decode base64: %w", err)
	}

	key := getMasterKey()
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("create gcm: %w", err)
	}

	nonceSize := gcm.NonceSize()
	if len(cipherBytes) < nonceSize {
		return "", errors.New("ciphertext too short")
	}

	nonce, actualCipherBytes := cipherBytes[:nonceSize], cipherBytes[nonceSize:]
	plainBytes, err := gcm.Open(nil, nonce, actualCipherBytes, nil)
	if err != nil {
		return "", fmt.Errorf("decrypt failed: %w", err)
	}

	return string(plainBytes), nil
}
