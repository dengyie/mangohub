package metric

import (
	"context"
	"testing"
	"time"
)

// TestDefinitionCachingAndInvalidation verifies that metric definitions are cached
// in memory to prevent high-frequency database queries, and that all mutation operations
// properly invalidate the cache.
func TestDefinitionCachingAndInvalidation(t *testing.T) {
	ctx := context.Background()
	dbDir := t.TempDir()
	store, err := Open(ctx, SQLiteInDir(dbDir))
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}
	defer store.Close()

	// 1. Initial state: Create one metric
	err = store.CreateMetric(ctx, Definition{
		Name:          "cache_test_cpu",
		Type:          TypeGauge,
		Unit:          "%",
		Description:   "CPU Test",
		RetentionDays: 7,
	})
	if err != nil {
		t.Fatalf("CreateMetric failed: %v", err)
	}

	// 2. First ListMetrics populates the cache
	defs1, err := store.ListMetrics(ctx)
	if err != nil {
		t.Fatalf("ListMetrics failed: %v", err)
	}
	if len(defs1) != 1 || defs1[0].Name != "cache_test_cpu" {
		t.Fatalf("unexpected definitions: %+v", defs1)
	}

	// Verify cache is populated
	store.defCacheMu.RLock()
	cachedCount := len(store.defCache)
	cachedAt := store.defCacheAt
	store.defCacheMu.RUnlock()
	if cachedCount != 1 || cachedAt.IsZero() {
		t.Fatalf("cache should be populated, got count=%d, at=%v", cachedCount, cachedAt)
	}

	// 3. Modifying returned slice should not mutate internal cache
	defs1[0].Name = "tampered"
	defs2, err := store.ListMetrics(ctx)
	if err != nil {
		t.Fatalf("ListMetrics failed: %v", err)
	}
	if defs2[0].Name != "cache_test_cpu" {
		t.Fatalf("cache was mutated by caller: %s", defs2[0].Name)
	}

	// 4. CreateMetric invalidates cache
	err = store.CreateMetric(ctx, Definition{
		Name:          "cache_test_mem",
		Type:          TypeGauge,
		Unit:          "bytes",
		Description:   "Memory Test",
		RetentionDays: 7,
	})
	if err != nil {
		t.Fatalf("CreateMetric failed: %v", err)
	}

	store.defCacheMu.RLock()
	isInvalidated := store.defCache == nil && store.defCacheAt.IsZero()
	store.defCacheMu.RUnlock()
	if !isInvalidated {
		t.Fatalf("expected cache to be invalidated after CreateMetric")
	}

	// Read again to re-populate cache
	defs3, err := store.ListMetrics(ctx)
	if err != nil || len(defs3) != 2 {
		t.Fatalf("expected 2 metrics after creation, got %d (err: %v)", len(defs3), err)
	}

	// 5. UpsertMetric invalidates cache
	err = store.UpsertMetric(ctx, Definition{
		Name:          "cache_test_mem",
		Type:          TypeGauge,
		Unit:          "MB",
		Description:   "Memory Test Updated",
		RetentionDays: 14,
	})
	if err != nil {
		t.Fatalf("UpsertMetric failed: %v", err)
	}
	store.defCacheMu.RLock()
	if store.defCache != nil {
		t.Fatalf("expected cache to be invalidated after UpsertMetric")
	}
	store.defCacheMu.RUnlock()

	// 6. UpdateMetricRetention invalidates cache and updates definition
	updatedDef, err := store.UpdateMetricRetention(ctx, "cache_test_mem", 30)
	if err != nil {
		t.Fatalf("UpdateMetricRetention failed: %v", err)
	}
	if updatedDef.RetentionDays != 30 {
		t.Fatalf("expected retention 30, got %d", updatedDef.RetentionDays)
	}
	// Verify subsequent read reflects updated retention
	defs4, err := store.ListMetrics(ctx)
	if err != nil {
		t.Fatalf("ListMetrics failed: %v", err)
	}
	for _, d := range defs4 {
		if d.Name == "cache_test_mem" && d.RetentionDays != 30 {
			t.Fatalf("cache has stale retention: %d", d.RetentionDays)
		}
	}

	// 7. SetMetricRetention updates retention and definition
	setDef, err := store.SetMetricRetention(ctx, "cache_test_mem", 10)
	if err != nil {
		t.Fatalf("SetMetricRetention failed: %v", err)
	}
	if setDef.RetentionDays != 10 {
		t.Fatalf("expected retention 10, got %d", setDef.RetentionDays)
	}
	defs5, err := store.ListMetrics(ctx)
	if err != nil {
		t.Fatalf("ListMetrics failed: %v", err)
	}
	for _, d := range defs5 {
		if d.Name == "cache_test_mem" && d.RetentionDays != 10 {
			t.Fatalf("cache has stale retention: %d", d.RetentionDays)
		}
	}

	// 8. DeleteMetric invalidates cache
	_, err = store.ListMetrics(ctx) // re-populate
	if err != nil {
		t.Fatalf("ListMetrics failed: %v", err)
	}
	err = store.DeleteMetric(ctx, "cache_test_mem")
	if err != nil {
		t.Fatalf("DeleteMetric failed: %v", err)
	}
	store.defCacheMu.RLock()
	if store.defCache != nil {
		t.Fatalf("expected cache to be invalidated after DeleteMetric")
	}
	store.defCacheMu.RUnlock()

	// 9. Cache expiry by TTL
	_, err = store.ListMetrics(ctx) // re-populate
	if err != nil {
		t.Fatalf("ListMetrics failed: %v", err)
	}
	store.defCacheMu.Lock()
	store.defCacheAt = time.Now().Add(-(defCacheTTL + time.Second))
	store.defCacheMu.Unlock()

	// When expired, calling ListMetrics refreshes the cache timestamp
	defsExpired, err := store.ListMetrics(ctx)
	if err != nil || len(defsExpired) != 1 {
		t.Fatalf("unexpected result after cache expiry: %v", err)
	}
	store.defCacheMu.RLock()
	newAt := store.defCacheAt
	store.defCacheMu.RUnlock()
	if time.Since(newAt) >= defCacheTTL {
		t.Fatalf("cache timestamp was not refreshed after TTL expiry")
	}
}
