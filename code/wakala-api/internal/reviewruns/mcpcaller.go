package reviewruns

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"sync"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

var errEmptyToolResult = errors.New("The tool sent back nothing")

type MCPCaller struct {
	Register func(server *mcp.Server)

	mu      sync.Mutex
	session *mcp.ClientSession
}

func (c *MCPCaller) Call(ctx context.Context, tool string, args map[string]any) ([]byte, error) {
	session, err := c.connected()
	if err != nil {
		return nil, err
	}
	result, err := session.CallTool(ctx, &mcp.CallToolParams{Name: tool, Arguments: args})
	if err != nil {
		return nil, err
	}
	if result.IsError {
		return nil, errors.New(textOf(result))
	}
	if result.StructuredContent == nil {
		return nil, errEmptyToolResult
	}
	return json.Marshal(result.StructuredContent)
}

func (c *MCPCaller) connected() (*mcp.ClientSession, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.session != nil {
		return c.session, nil
	}
	server := mcp.NewServer(&mcp.Implementation{Name: "review-runs", Version: "1.0.0"}, nil)
	c.Register(server)
	serverSide, clientSide := mcp.NewInMemoryTransports()
	if _, err := server.Connect(context.Background(), serverSide, nil); err != nil {
		return nil, err
	}
	client := mcp.NewClient(&mcp.Implementation{Name: "review-runner", Version: "1.0.0"}, nil)
	session, err := client.Connect(context.Background(), clientSide, nil)
	if err != nil {
		return nil, err
	}
	c.session = session
	return session, nil
}

func textOf(result *mcp.CallToolResult) string {
	var parts []string
	for _, content := range result.Content {
		if text, ok := content.(*mcp.TextContent); ok {
			parts = append(parts, text.Text)
		}
	}
	return strings.Join(parts, " ")
}
