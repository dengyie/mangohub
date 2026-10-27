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
// The deadline also guards the shared mutex: an unbounded write here would
// stall every other writer on this conn for the full TCP retransmission
// window, so every writer on the report conn must use a bounded variant.
func (sc *SafeConn) WriteMessageWithDeadline(messageType int, data []byte, timeout time.Duration) error {
	sc.mu.Lock()
	defer sc.mu.Unlock()
	return sc.boundedWrite(func() error {
		return sc.conn.WriteMessage(messageType, data)
	}, timeout)
}

// WriteJSONWithDeadline is the bounded variant of WriteJSON, for the same
// reason every shared-conn write must carry a deadline.
func (sc *SafeConn) WriteJSONWithDeadline(v interface{}, timeout time.Duration) error {
	sc.mu.Lock()
	defer sc.mu.Unlock()
	return sc.boundedWrite(func() error {
		return sc.conn.WriteJSON(v)
	}, timeout)
}

// boundedWrite runs one write under a held mutex with a write deadline, then
// clears the deadline. gorilla keeps the deadline armed for future writes, so
// leaving it set would make deadline-less writers fail outright whenever they
// run more than one timeout later.
func (sc *SafeConn) boundedWrite(write func() error, timeout time.Duration) error {
	if timeout > 0 {
		if err := sc.conn.SetWriteDeadline(time.Now().Add(timeout)); err != nil {
			return err
		}
	}
	err := write()
	if timeout > 0 {
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
