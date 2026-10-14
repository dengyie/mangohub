package server

import (
	"bufio"
	"io"
	"net"
	"net/http"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/klauspost/compress/gzip"
)

var gzipWriterPool = sync.Pool{
	New: func() any {
		w, _ := gzip.NewWriterLevel(io.Discard, gzip.DefaultCompression)
		return w
	},
}

// gzipResponseWriter 拦截并对可压缩的文本/JSON/JS/CSS 响应进行 gzip 压缩，同时保留 Hijacker 和 Flusher 接口。
type gzipResponseWriter struct {
	gin.ResponseWriter
	writer       *gzip.Writer
	wroteHeader  bool
	isCompressed bool
}

func (w *gzipResponseWriter) shouldCompress() bool {
	if w.Status() == http.StatusNotModified || w.Status() == http.StatusNoContent {
		return false
	}
	header := w.Header()
	if header.Get("Content-Encoding") != "" {
		return false
	}
	if strings.Contains(header.Get("Cache-Control"), "no-transform") {
		return false
	}

	contentType := header.Get("Content-Type")
	if contentType == "" {
		return false
	}
	// 事件流和分块流绝不缓冲压缩
	if strings.HasPrefix(contentType, "text/event-stream") || strings.HasPrefix(contentType, "multipart/") {
		return false
	}

	return strings.HasPrefix(contentType, "text/") ||
		strings.Contains(contentType, "json") ||
		strings.Contains(contentType, "javascript") ||
		strings.Contains(contentType, "xml") ||
		strings.Contains(contentType, "svg")
}

func (w *gzipResponseWriter) initGzip() {
	if w.wroteHeader {
		return
	}
	w.wroteHeader = true

	if w.shouldCompress() {
		w.isCompressed = true
		gz := gzipWriterPool.Get().(*gzip.Writer)
		gz.Reset(w.ResponseWriter)
		w.writer = gz

		w.Header().Set("Content-Encoding", "gzip")
		w.Header().Add("Vary", "Accept-Encoding")
		w.Header().Del("Content-Length")
	}
}

func (w *gzipResponseWriter) WriteHeader(code int) {
	w.ResponseWriter.WriteHeader(code)
}

func (w *gzipResponseWriter) WriteHeaderNow() {
	if !w.wroteHeader {
		w.initGzip()
	}
	w.ResponseWriter.WriteHeaderNow()
}

func (w *gzipResponseWriter) Write(data []byte) (int, error) {
	if !w.wroteHeader {
		w.initGzip()
	}
	if w.isCompressed && w.writer != nil {
		return w.writer.Write(data)
	}
	return w.ResponseWriter.Write(data)
}

func (w *gzipResponseWriter) WriteString(s string) (int, error) {
	if !w.wroteHeader {
		w.initGzip()
	}
	if w.isCompressed && w.writer != nil {
		return io.WriteString(w.writer, s)
	}
	return w.ResponseWriter.WriteString(s)
}

func (w *gzipResponseWriter) Flush() {
	if w.isCompressed && w.writer != nil {
		_ = w.writer.Flush()
	}
	if flusher, ok := w.ResponseWriter.(http.Flusher); ok {
		flusher.Flush()
	}
}

func (w *gzipResponseWriter) Close() error {
	if w.isCompressed && w.writer != nil {
		err := w.writer.Close()
		gzipWriterPool.Put(w.writer)
		w.writer = nil
		return err
	}
	return nil
}

func (w *gzipResponseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	if hijacker, ok := w.ResponseWriter.(http.Hijacker); ok {
		return hijacker.Hijack()
	}
	return nil, nil, http.ErrNotSupported
}

// CompressionMiddleware 为安全的可压缩静态资源和 API 响应启用高性能 Gzip 传输压缩。
// 旁路所有 WebSocket 握手升级和文件分片流式中继传输。
func CompressionMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 1. 客户端不支持 gzip 直接放行
		if !strings.Contains(c.GetHeader("Accept-Encoding"), "gzip") {
			c.Next()
			return
		}

		// 2. WebSocket 升级请求旁路放行
		if strings.EqualFold(c.GetHeader("Upgrade"), "websocket") ||
			strings.Contains(strings.ToLower(c.GetHeader("Connection")), "upgrade") {
			c.Next()
			return
		}

		// 3. 流式文件传输路由旁路放行
		if strings.HasPrefix(c.Request.URL.Path, "/api/clients/transfer/") {
			c.Next()
			return
		}

		gzWriter := &gzipResponseWriter{
			ResponseWriter: c.Writer,
		}
		defer func() {
			_ = gzWriter.Close()
		}()

		c.Writer = gzWriter
		c.Next()
	}
}
