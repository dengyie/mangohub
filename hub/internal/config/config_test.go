package config_test

import (
	"fmt"
	"sync"
	"testing"

	"github.com/dengyie/mangohub/hub/internal/config"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func setupTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("failed to open test sqlite: %v", err)
	}
	config.SetDb(db)
	return db
}

type TestSettings struct {
	SiteName    string `json:"sitename" default:"TestSite"`
	Port        int    `json:"port" default:"8080"`
	EnableAudit bool   `json:"enable_audit" default:"true"`
	Description string `json:"description"`
}

func TestConfigCacheAndCRUD(t *testing.T) {
	db := setupTestDB(t)

	// 1. GetAs with default (writes through to DB and cache)
	val, err := config.GetAs[string]("app_title", "DefaultTitle")
	if err != nil {
		t.Fatalf("GetAs failed: %v", err)
	}
	if val != "DefaultTitle" {
		t.Fatalf("expected DefaultTitle, got %q", val)
	}

	// 2. Subsequent GetAs hits memory cache
	val2, err := config.GetAs[string]("app_title")
	if err != nil || val2 != "DefaultTitle" {
		t.Fatalf("cached GetAs failed: %v, val=%q", err, val2)
	}

	// 3. Set updates DB and cache
	if err := config.Set("app_title", "NewTitle"); err != nil {
		t.Fatalf("Set failed: %v", err)
	}
	val3, err := config.GetAs[string]("app_title")
	if err != nil || val3 != "NewTitle" {
		t.Fatalf("expected NewTitle after Set, got %q", val3)
	}

	// 4. Verify in DB directly
	var dbItem config.ConfigItem
	if err := db.First(&dbItem, "key = ?", "app_title").Error; err != nil {
		t.Fatalf("DB query failed: %v", err)
	}
	if dbItem.Value != `"NewTitle"` {
		t.Fatalf("DB item value mismatch: %s", dbItem.Value)
	}

	// 5. GetMany with defaults
	many, err := config.GetMany(map[string]any{
		"theme":      "deer",
		"items_page": 20,
	})
	if err != nil {
		t.Fatalf("GetMany failed: %v", err)
	}
	if many["theme"] != "deer" || fmt.Sprintf("%v", many["items_page"]) != "20" {
		t.Fatalf("GetMany results mismatch: %v", many)
	}

	// 6. GetManyAs with struct tags
	settings, err := config.GetManyAs[TestSettings]()
	if err != nil {
		t.Fatalf("GetManyAs failed: %v", err)
	}
	if settings.SiteName != "TestSite" || settings.Port != 8080 || !settings.EnableAudit {
		t.Fatalf("GetManyAs struct mismatch: %+v", settings)
	}

	// 7. Delete
	if err := config.Delete("app_title"); err != nil {
		t.Fatalf("Delete failed: %v", err)
	}
	_, err = config.GetAs[string]("app_title")
	if err == nil {
		t.Fatalf("expected error after delete, got nil")
	}

	// 8. DeleteMany
	if err := config.DeleteMany([]string{"theme", "items_page"}); err != nil {
		t.Fatalf("DeleteMany failed: %v", err)
	}
}

func TestConfigConcurrency(t *testing.T) {
	setupTestDB(t)

	var wg sync.WaitGroup
	// Concurrently read and write
	for i := 0; i < 20; i++ {
		wg.Add(2)
		workerID := i
		go func() {
			defer wg.Done()
			_ = config.Set(fmt.Sprintf("key_%d", workerID), workerID*10)
		}()
		go func() {
			defer wg.Done()
			_, _ = config.GetAs[int](fmt.Sprintf("key_%d", workerID), 0)
			_, _ = config.GetAll()
		}()
	}
	wg.Wait()
}
