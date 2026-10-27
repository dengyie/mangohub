package ws

import (
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type SafeConn struct {
	conn *websocket.Conn
	mu   sync.Mutex
}

func NewSafeConn(conn *websocket.Conn) *SafeConn {
	return &SafeConn{
		conn: conn,
		mu:   sync.Mutex{},
	}
}

func (sc *SafeConn) WriteMessage(messageType int, data []byte) error {
	sc.mu.Lock()
	defer sc.mu.Unlock()
	return sc.conn.WriteMessage(messageType, data)
}

// WriteMessageWithDeadline bounds a single write by timeout.
// A peer that disappears silently (no FIN/RST, e.g. a blackholed path) leaves
// the write blocked until the kernel exhausts its TCP retransmissions, which
// takes minutes under the default net.ipv4.tcp_retries2. Letting the deadline
// expire marks the connection corrupt so the caller's error path reconnects.
func (sc *SafeConn) WriteMessageWithDeadline(messageType int, data []byte, timeout time.Duration) error {
	sc.mu.Lock()
	defer sc.mu.Unlock()
	if timeout > 0 {
		if err := sc.conn.SetWriteDeadline(time.Now().Add(timeout)); err != nil {
			return err
		}
	}
	err := sc.conn.WriteMessage(messageType, data)
	if timeout > 0 {
		// The report conn is shared with terminal and ping-result writers that
		// set no deadline of their own. gorilla keeps the deadline for future
		// writes, so leaving it set would make those writers fail outright
		// whenever they run more than one timeout after the last report.
		// Clear it so this timeout bounds only this write.
		_ = sc.conn.SetWriteDeadline(time.Time{})
	}
	return err
}

func (sc *SafeConn) WriteJSON(v interface{}) error {
	sc.mu.Lock()
	defer sc.mu.Unlock()
	return sc.conn.WriteJSON(v)
}

func (sc *SafeConn) Close() error {
	sc.mu.Lock()
	defer sc.mu.Unlock()
	return sc.conn.Close()
}
func (sc *SafeConn) ReadMessage() (int, []byte, error) {
	// sc.mu.Lock()
	// defer sc.mu.Unlock()
	return sc.conn.ReadMessage()
}
func (sc *SafeConn) ReadJSON(v interface{}) error {
	// sc.mu.Lock()
	// defer sc.mu.Unlock()
	return sc.conn.ReadJSON(v)
}
func (sc *SafeConn) SetReadDeadline(t time.Time) error {
	// sc.mu.Lock()
	// defer sc.mu.Unlock()
	return sc.conn.SetReadDeadline(t)
}
func (sc *SafeConn) GetConn() *websocket.Conn {
	sc.mu.Lock()
	defer sc.mu.Unlock()
	return sc.conn
}
