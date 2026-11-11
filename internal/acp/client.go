// Package acp is a minimal Agent Client Protocol (v1) client speaking
// JSON-RPC 2.0 over the stdio of a child process (`agy acp`).
package acp

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"sync"
	"sync/atomic"
	"time"
)

const (
	CodeAuthRequired = -32000
	CodeNotFound     = -32002
)

type RPCError struct {
	Code    int             `json:"code"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data,omitempty"`
}

func (e *RPCError) Error() string { return fmt.Sprintf("acp: %s (code %d)", e.Message, e.Code) }

type message struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      *json.RawMessage `json:"id,omitempty"`
	Method  string          `json:"method,omitempty"`
	Params  json.RawMessage `json:"params,omitempty"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *RPCError       `json:"error,omitempty"`
}

type response struct {
	result json.RawMessage
	err    *RPCError
}

// Handler receives notifications and agent->client requests.
type Handler interface {
	// OnNotification is called for every notification (no id).
	OnNotification(method string, params json.RawMessage)
	// OnRequest is called for agent->client requests; it must return a
	// result or an RPCError. It may block (permission prompts do).
	OnRequest(ctx context.Context, method string, params json.RawMessage) (any, *RPCError)
}

type Client struct {
	cmd     *exec.Cmd
	stdin   io.WriteCloser
	writeMu sync.Mutex
	nextID  atomic.Int64
	mu      sync.Mutex
	pending map[int64]chan response
	handler Handler
	done    chan struct{}
	exitErr error
	logf    func(format string, args ...any)
	ctx     context.Context
	cancel  context.CancelFunc
}

// Start launches the binary with args and begins reading its stdout.
func Start(binary string, args []string, env []string, handler Handler, logf func(string, ...any)) (*Client, error) {
	ctx, cancel := context.WithCancel(context.Background())
	cmd := exec.CommandContext(ctx, binary, args...)
	cmd.Env = append(os.Environ(), env...)
	hideWindow(cmd)
	stdin, err := cmd.StdinPipe()
	if err != nil {
		cancel()
		return nil, err
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		cancel()
		return nil, err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		cancel()
		return nil, err
	}
	if err := cmd.Start(); err != nil {
		cancel()
		return nil, err
	}
	if logf == nil {
		logf = func(string, ...any) {}
	}
	c := &Client{cmd: cmd, stdin: stdin, pending: map[int64]chan response{}, handler: handler, done: make(chan struct{}), logf: logf, ctx: ctx, cancel: cancel}
	go c.readLoop(stdout)
	go func() {
		sc := bufio.NewScanner(stderr)
		sc.Buffer(make([]byte, 64*1024), 4*1024*1024)
		for sc.Scan() {
			c.logf("agy stderr: %s", sc.Text())
		}
	}()
	go func() {
		c.exitErr = cmd.Wait()
		c.mu.Lock()
		for id, ch := range c.pending {
			ch <- response{err: &RPCError{Code: -32001, Message: "Antigravity CLI exited"}}
			delete(c.pending, id)
		}
		c.mu.Unlock()
		close(c.done)
	}()
	return c, nil
}

// Done is closed when the child process exits.
func (c *Client) Done() <-chan struct{} { return c.done }

func (c *Client) Alive() bool {
	select {
	case <-c.done:
		return false
	default:
		return true
	}
}

func (c *Client) Close() {
	c.cancel()
	_ = c.stdin.Close()
	select {
	case <-c.done:
	case <-time.After(3 * time.Second):
		if c.cmd.Process != nil {
			_ = c.cmd.Process.Kill()
		}
	}
}

func (c *Client) write(v any) error {
	b, err := json.Marshal(v)
	if err != nil {
		return err
	}
	c.writeMu.Lock()
	defer c.writeMu.Unlock()
	c.logf(">> %s", truncate(b, 400))
	_, err = c.stdin.Write(append(b, '\n'))
	return err
}

// Call sends a request and decodes the result into out (may be nil).
func (c *Client) Call(ctx context.Context, method string, params any, out any) error {
	if !c.Alive() {
		return errors.New("Antigravity CLI is not running")
	}
	id := c.nextID.Add(1)
	ch := make(chan response, 1)
	c.mu.Lock()
	c.pending[id] = ch
	c.mu.Unlock()
	req := map[string]any{"jsonrpc": "2.0", "id": id, "method": method}
	if params != nil {
		req["params"] = params
	} else {
		req["params"] = map[string]any{}
	}
	if err := c.write(req); err != nil {
		c.mu.Lock()
		delete(c.pending, id)
		c.mu.Unlock()
		return err
	}
	select {
	case r := <-ch:
		if r.err != nil {
			return r.err
		}
		if out != nil && len(r.result) > 0 {
			return json.Unmarshal(r.result, out)
		}
		return nil
	case <-ctx.Done():
		c.mu.Lock()
		delete(c.pending, id)
		c.mu.Unlock()
		return ctx.Err()
	case <-c.done:
		return errors.New("Antigravity CLI exited")
	}
}

func (c *Client) Notify(method string, params any) error {
	if params == nil {
		params = map[string]any{}
	}
	return c.write(map[string]any{"jsonrpc": "2.0", "method": method, "params": params})
}

func (c *Client) respond(id json.RawMessage, result any, rpcErr *RPCError) {
	msg := map[string]any{"jsonrpc": "2.0", "id": id}
	if rpcErr != nil {
		msg["error"] = rpcErr
	} else {
		if result == nil {
			result = map[string]any{}
		}
		msg["result"] = result
	}
	_ = c.write(msg)
}

func (c *Client) readLoop(r io.Reader) {
	sc := bufio.NewScanner(r)
	sc.Buffer(make([]byte, 1024*1024), 64*1024*1024)
	for sc.Scan() {
		line := sc.Bytes()
		if len(line) == 0 {
			continue
		}
		c.logf("<< %s", truncate(line, 400))
		var m message
		if err := json.Unmarshal(line, &m); err != nil {
			c.logf("acp: bad json: %v", err)
			continue
		}
		switch {
		case m.Method != "" && m.ID != nil:
			id := *m.ID
			go func(id json.RawMessage, method string, params json.RawMessage) {
				if c.handler == nil {
					c.respond(id, nil, &RPCError{Code: -32601, Message: "method not supported"})
					return
				}
				res, rpcErr := c.handler.OnRequest(c.ctx, method, params)
				c.respond(id, res, rpcErr)
			}(id, m.Method, m.Params)
		case m.Method != "":
			if c.handler != nil {
				c.handler.OnNotification(m.Method, m.Params)
			}
		case m.ID != nil:
			var id int64
			if err := json.Unmarshal(*m.ID, &id); err != nil {
				continue
			}
			c.mu.Lock()
			ch, ok := c.pending[id]
			if ok {
				delete(c.pending, id)
			}
			c.mu.Unlock()
			if ok {
				ch <- response{result: m.Result, err: m.Error}
			}
		}
	}
}

func truncate(b []byte, n int) string {
	if len(b) <= n {
		return string(b)
	}
	return string(b[:n]) + "…"
}
