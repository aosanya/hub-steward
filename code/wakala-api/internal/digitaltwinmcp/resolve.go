package digitaltwinmcp

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"strings"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	mwanachamadigitaltwin "github.com/aosanya/mwanachama-backend-digitaltwin"
	"github.com/aosanya/mwanachama-backend-digitaltwin/routes"
)

type TwinResolver func(ctx context.Context, instanceID string) (mwanachamadigitaltwin.TwinManager, error)

var servedKinds = []string{"digitaltwin.address.", "digitaltwin.tenure.", "digitaltwin.land_use."}

var servedActions = map[string]bool{
	"digitaltwin.node.list": true,
	"digitaltwin.node.read": true,
}

func Served(action string) bool {
	if servedActions[action] {
		return true
	}
	for _, prefix := range servedKinds {
		if strings.HasPrefix(action, prefix) {
			return true
		}
	}
	return false
}

const instanceArgument = "instance_id"

var ErrInstanceRequired = errors.New("instance_id is required")

type shapeOnly struct {
	mwanachamadigitaltwin.TwinManager
}

func RegisterResolvedTools(server *mcp.Server, resolve TwinResolver, m routes.Mount) {
	shape, err := routes.BuildTools(shapeOnly{}, m)
	if err != nil {
		panic(fmt.Sprintf("digitaltwin mcp: %v", err))
	}
	for _, t := range shape {
		if !Served(t.Action) {
			continue
		}
		var schema map[string]any
		if err := json.Unmarshal(t.InputSchema, &schema); err != nil {
			panic(fmt.Sprintf("digitaltwin mcp: %s input schema: %v", t.Name, err))
		}
		server.AddTool(&mcp.Tool{
			Name:        t.Name,
			Title:       t.Title,
			Description: t.Description,
			InputSchema: withInstance(schema),
		}, resolvedHandler(t.Name, resolve, m))
	}
}

func withInstance(schema map[string]any) map[string]any {
	props, _ := schema["properties"].(map[string]any)
	if props == nil {
		props = map[string]any{}
	}
	props[instanceArgument] = map[string]any{
		"type":        "string",
		"description": "The agency whose digital twin to reach.",
	}
	schema["properties"] = props
	required, _ := schema["required"].([]any)
	schema["required"] = append(required, instanceArgument)
	return schema
}

func resolvedHandler(name string, resolve TwinResolver, m routes.Mount) mcp.ToolHandler {
	return func(ctx context.Context, req *mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		instanceID, rest, err := splitInstance(req.Params.Arguments)
		if err != nil {
			return refusal(err), nil
		}
		repo, err := resolve(ctx, instanceID)
		if err != nil {
			return refusal(err), nil
		}
		tool, err := toolFor(repo, m, name)
		if err != nil {
			return refusal(err), nil
		}
		out, err := tool.Invoke(ctx, rest)
		if err != nil {
			return refusal(err), nil
		}
		structured, text := envelope(name, out)
		return &mcp.CallToolResult{
			Content:           []mcp.Content{&mcp.TextContent{Text: text}},
			StructuredContent: structured,
		}, nil
	}
}

func toolFor(repo mwanachamadigitaltwin.TwinManager, m routes.Mount, name string) (routes.Tool, error) {
	tools, err := routes.BuildTools(repo, m)
	if err != nil {
		return routes.Tool{}, err
	}
	for _, t := range tools {
		if t.Name == name {
			return t, nil
		}
	}
	return routes.Tool{}, fmt.Errorf("unknown tool %s", name)
}

func refusal(err error) *mcp.CallToolResult {
	return &mcp.CallToolResult{
		IsError: true,
		Content: []mcp.Content{&mcp.TextContent{Text: err.Error()}},
	}
}

func envelope(name string, out any) (any, string) {
	rv := reflect.ValueOf(out)
	if rv.IsValid() && (rv.Kind() == reflect.Slice || rv.Kind() == reflect.Array) {
		return map[string]any{"items": out}, fmt.Sprintf("Found %d item(s)", rv.Len())
	}
	return out, fmt.Sprintf("%s completed", name)
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
