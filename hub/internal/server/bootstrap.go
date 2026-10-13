package server

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/dengyie/mangohub/hub/database/dbcore"
	"github.com/dengyie/mangohub/hub/database/ssh"
	"github.com/dengyie/mangohub/hub/internal/config"
	"github.com/dengyie/mangohub/hub/utils"
)

// Bootstrap initializes the data directory, primary database, and settings.
func (a *App) Bootstrap() error {
	if err := os.MkdirAll("./data/theme", os.ModePerm); err != nil {
		return fmt.Errorf("failed to create theme directory: %w", err)
	}
	if err := os.MkdirAll("./data/plugin", os.ModePerm); err != nil {
		return fmt.Errorf("failed to create plugin directory: %w", err)
	}
	if err := os.MkdirAll("./data/plugin-data", os.ModePerm); err != nil {
		return fmt.Errorf("failed to create plugin storage directory: %w", err)
	}

	dbcore.SetVersionID(utils.CurrentVersion + "-" + utils.VersionHash)
	if err := dbcore.Initialize(); err != nil {
		return fmt.Errorf("failed to initialize database: %w", err)
	}
	a.dbReady = true
	a.addCleanup("database", func(context.Context) error { return dbcore.Close() })

	// Vault 主密钥自检：MANGOHUB_SECRET_KEY 未设置时回退为「固定前缀+hostname」，
	// hostname 非机密，密文仅等效混淆。MANGOHUB_REQUIRE_SECRET_KEY=1 时拒绝启动。
	if os.Getenv("MANGOHUB_SECRET_KEY") == "" {
		if os.Getenv("MANGOHUB_REQUIRE_SECRET_KEY") == "1" {
			return fmt.Errorf("MANGOHUB_SECRET_KEY is not set and MANGOHUB_REQUIRE_SECRET_KEY=1: refusing to start with the hostname-derived default vault key")
		}
		log.Println("[security] WARNING: MANGOHUB_SECRET_KEY is not set; the SSH vault master key falls back to a hostname-derived value, so encrypted private keys are only obfuscated. Set a high-entropy MANGOHUB_SECRET_KEY (note: changing it or the container hostname makes existing vault ciphertext undecryptable).")
	}
	_ = ssh.EnsureDefaultFleetKey()

	gin.SetMode(gin.ReleaseMode)
	settings, err := config.GetManyAs[config.Settings]()
	if err != nil {
		return fmt.Errorf("failed to load settings: %w", err)
	}
	a.settings = settings
	return nil
}
