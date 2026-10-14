package server

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/klauspost/compress/gzip"
)

func TestCompressionMiddlewareCompressesJSON(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(CompressionMiddleware())
	r.GET("/test-json", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "hello compression world"})
	})

	req := httptest.NewRequest(http.MethodGet, "/test-json", nil)
	req.Header.Set("Accept-Encoding", "gzip")
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", w.Code)
	}
	if w.Header().Get("Content-Encoding") != "gzip" {
		t.Fatalf("expected Content-Encoding: gzip, got %q", w.Header().Get("Content-Encoding"))
	}

	gr, err := gzip.NewReader(bytes.NewReader(w.Body.Bytes()))
	if err != nil {
		t.Fatalf("failed to decode gzip response: %v", err)
	}
	defer gr.Close()
	decompressed, err := io.ReadAll(gr)
	if err != nil {
		t.Fatalf("failed to read decompressed bytes: %v", err)
	}
	if !bytes.Contains(decompressed, []byte("hello compression world")) {
		t.Fatalf("unexpected decompressed content: %s", string(decompressed))
	}
}

func TestCompressionMiddlewareSkipsWhenNoGzip(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(CompressionMiddleware())
	r.GET("/plain", func(c *gin.Context) {
		c.String(http.StatusOK, "uncompressed text")
	})

	req := httptest.NewRequest(http.MethodGet, "/plain", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	if w.Header().Get("Content-Encoding") == "gzip" {
		t.Fatalf("did not expect gzip encoding when client has no accept-encoding")
	}
	if w.Body.String() != "uncompressed text" {
		t.Fatalf("unexpected body: %s", w.Body.String())
	}
}

func TestCompressionMiddlewareBypassesStreamingTransfer(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(CompressionMiddleware())
	r.GET("/api/clients/transfer/chunk123", func(c *gin.Context) {
		c.Data(http.StatusOK, "application/octet-stream", []byte("raw chunk payload"))
	})

	req := httptest.NewRequest(http.MethodGet, "/api/clients/transfer/chunk123", nil)
	req.Header.Set("Accept-Encoding", "gzip")
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	if w.Header().Get("Content-Encoding") == "gzip" {
		t.Fatalf("expected transfer endpoint to bypass compression")
	}
	if w.Body.String() != "raw chunk payload" {
		t.Fatalf("unexpected body: %s", w.Body.String())
	}
}
