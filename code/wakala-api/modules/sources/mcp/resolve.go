package mcp

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	sources "wakalaserver/modules/sources"
	"wakalaserver/modules/sources/routes"
)

type ManagerResolver func(ctx context.Context, instanceID string) (sources.SourceManager, error)

const instanceArgument = "instance_id"

var ErrInstanceRequired = errors.New("instance_id is required")

type managerKey struct{}

func RegisterResolvedTools(server *mcp.Server, resolve ManagerResolver, m routes.Mount) {
	for _, t := range routes.Tools(resolving{resolve: resolve}, m) {
		var schema map[string]any
		if err := json.Unmarshal(t.InputSchema, &schema); err != nil {
			panic(fmt.Sprintf("sources mcp: %s input schema: %v", t.Name, err))
		}
		server.AddTool(&mcp.Tool{
			Name:        t.Name,
			Title:       t.Title,
			Description: t.Description,
			InputSchema: withInstance(schema),
		}, resolvedHandlerFor(t, resolve))
	}
}

func withInstance(schema map[string]any) map[string]any {
	props, _ := schema["properties"].(map[string]any)
	if props == nil {
		props = map[string]any{}
	}
	props[instanceArgument] = map[string]any{
		"type":        "string",
		"description": "The agency whose sources to reach.",
	}
	schema["properties"] = props
	required, _ := schema["required"].([]any)
	schema["required"] = append(required, instanceArgument)
	return schema
}

func resolvedHandlerFor(t routes.Tool, resolve ManagerResolver) mcp.ToolHandler {
	inner := handlerFor(t)
	return func(ctx context.Context, req *mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		instanceID, rest, err := splitInstance(req.Params.Arguments)
		if err != nil {
			return &mcp.CallToolResult{
				IsError: true,
				Content: []mcp.Content{&mcp.TextContent{Text: err.Error()}},
			}, nil
		}
		sm, err := resolve(ctx, instanceID)
		if err != nil {
			return &mcp.CallToolResult{
				IsError: true,
				Content: []mcp.Content{&mcp.TextContent{Text: err.Error()}},
			}, nil
		}
		forwarded := *req
		params := *req.Params
		params.Arguments = rest
		forwarded.Params = &params
		return inner(context.WithValue(ctx, managerKey{}, sm), &forwarded)
	}
}

func splitInstance(raw json.RawMessage) (string, json.RawMessage, error) {
	args := map[string]json.RawMessage{}
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &args); err != nil {
			return "", nil, err
		}
	}
	var instanceID string
	if v, ok := args[instanceArgument]; ok {
		if err := json.Unmarshal(v, &instanceID); err != nil {
			return "", nil, ErrInstanceRequired
		}
	}
	if instanceID == "" {
		return "", nil, ErrInstanceRequired
	}
	delete(args, instanceArgument)
	rest, err := json.Marshal(args)
	return instanceID, rest, err
}
