package security

import (
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	logger "github.com/dengyie/mangohub/hub/utils/log"
)

// Auth-failure rate limiting defaults. Tuned well above any legitimate
// traffic: agents authenticate on the first attempt and browsers only hit
// 401 on expired sessions; the observed probe pattern is 15-30 401s/min
// from a single address.
const (
	authFailWindow     = time.Minute
	authFailLimit      = 20
	authFailBlockFor   = 15 * time.Minute
	authFailBucketSize = 4096 // max tracked IPs before stale pruning kicks in
)

type authFailState struct {
	mu           sync.Mutex
	hits         map[string][]time.Time
	blockedUntil map[string]time.Time
}

// AuthFailLimiter counts 401 responses per source address over a sliding
// window and, once the limit is exceeded, answers further requests from that
// address with 429 for a cooldown period. Successful authentication is never
// counted, so a misconfigured agent can fix its token and recover after the
// window without operator action.
func AuthFailLimiter() gin.HandlerFunc {
	st := &authFailState{
		hits:         make(map[string][]time.Time),
		blockedUntil: make(map[string]time.Time),
	}
	return st.middleware()
}

func (st *authFailState) middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := authFailClientIP(c)
		now := time.Now()

		st.mu.Lock()
		if until, blocked := st.blockedUntil[ip]; blocked {
			if now.Before(until) {
				st.mu.Unlock()
				retry := int(time.Until(until).Seconds()) + 1
				c.Header("Retry-After", strconv.Itoa(retry))
				c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
					"status": "error",
					"error":  "Too many failed authentication attempts. Retry later.",
				})
				return
			}
			delete(st.blockedUntil, ip)
		}
		st.mu.Unlock()

		c.Next()

		// Only failures count; the response phase sees the final status even
		// for handlers that aborted.
		if c.Writer.Status() != http.StatusUnauthorized {
			return
		}

		st.mu.Lock()
		cutoff := now.Add(-authFailWindow)
		arr := append(st.hits[ip], now)
		i := 0
		for i < len(arr) && arr[i].Before(cutoff) {
			i++
		}
		arr = arr[i:]
		if len(arr) > authFailLimit {
			st.blockedUntil[ip] = now.Add(authFailBlockFor)
			delete(st.hits, ip)
			st.mu.Unlock()
			logger.Warnf("server", "[security] auth-fail rate limit engaged for %s: >%d 401s in %s, blocking for %s",
				ip, authFailLimit, authFailWindow, authFailBlockFor)
			return
		}
		st.hits[ip] = arr
		if len(st.hits) > authFailBucketSize {
			st.pruneLocked(now)
		}
		st.mu.Unlock()
	}
}

func (st *authFailState) pruneLocked(now time.Time) {
	cutoff := now.Add(-authFailWindow)
	for ip, arr := range st.hits {
		if len(arr) == 0 || arr[len(arr)-1].Before(cutoff) {
			delete(st.hits, ip)
		}
	}
	for ip, until := range st.blockedUntil {
		if now.After(until) {
			delete(st.blockedUntil, ip)
		}
	}
}

// authFailClientIP resolves the true source address. All public traffic
// arrives through the Cloudflare tunnel (RemoteAddr is a private hop), so
// headers are only trusted in that topology — and only CF-Connecting-IP,
// which Cloudflare sets from the actual socket and clients cannot forge. For
// direct public connections every header is client-controlled, so the socket
// address wins. Trusting X-Forwarded-For here would let a probe rotate
// forged IPs and bypass the limit entirely.
func authFailClientIP(c *gin.Context) string {
	remote := c.Request.RemoteAddr
	if host, _, err := net.SplitHostPort(remote); err == nil {
		remote = host
	}
	if isTrustedHop(remote) {
		if v := strings.TrimSpace(c.GetHeader("CF-Connecting-IP")); v != "" {
			return v
		}
		if v := strings.TrimSpace(c.GetHeader("X-Real-IP")); v != "" {
			return v
		}
	}
	return remote
}

func isTrustedHop(ip string) bool {
	parsed := net.ParseIP(ip)
	if parsed == nil {
		return false
	}
	return parsed.IsLoopback() || parsed.IsPrivate() || parsed.IsLinkLocalUnicast()
}
