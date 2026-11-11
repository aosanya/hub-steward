package http

import (
	"context"
	"encoding/json"
	"fmt"
	"reflect"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	mwanachamataskmanager "wakalaserver/modules/taskmanager"
	taskmanagerroutes "wakalaserver/modules/taskmanager/routes"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

type taskManagerResolver func(ctx context.Context, instanceID string) (mwanachamataskmanager.TaskManager, error)

func (d *Deps) resolveTaskManager(ctx context.Context, instanceID string) (mwanachamataskmanager.TaskManager, error) {
	return d.taskManagerFor(ctx, d.Registry, instanceID)
}

func (d *Deps) registerTaskManagerMCPTools(server *mcp.Server, resolve taskManagerResolver) {
	reg := d.Registry
	actions := map[string]string{}
	for i, t := range taskmanagerroutes.ToolShape() {
		actions[t.Name] = t.Action
		server.AddTool(&mcp.Tool{
			Name:        t.Name,
			Title:       t.Title,
			Description: t.Description,
			InputSchema: withInstanceID(t.Name, t.InputSchema),
		}, taskManagerToolHandler(i, t.Name, resolve, reg))
	}
	d.guardTaskToolPermissions(server, actions)
}

func withInstanceID(name string, raw json.RawMessage) map[string]any {
	schema := map[string]any{}
	if err := json.Unmarshal(raw, &schema); err != nil {
		panic(fmt.Sprintf("taskmanager mcp: %s input schema: %v", name, err))
	}
	props, _ := schema["properties"].(map[string]any)
	if props == nil {
		props = map[string]any{}
	}
	props["instance_id"] = map[string]any{"type": "string", "description": "The agency whose task board this call reads or writes."}
	schema["properties"] = props
	required, _ := schema["required"].([]any)
	schema["required"] = append(required, "instance_id")
	schema["type"] = "object"
	return schema
}

func taskManagerToolHandler(idx int, name string, resolve taskManagerResolver, reg agencies.Registry) mcp.ToolHandler {
	return func(ctx context.Context, req *mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := map[string]json.RawMessage{}
		if len(req.Params.Arguments) > 0 {
			if err := json.Unmarshal(req.Params.Arguments, &args); err != nil {
				return toolError(err), nil
			}
		}
		var instanceID string
		if raw, ok := args["instance_id"]; ok {
			_ = json.Unmarshal(raw, &instanceID)
		}
		delete(args, "instance_id")
		tm, err := resolve(ctx, instanceID)
		if err != nil {
			return toolError(err), nil
		}
		if assigneeGatedTools[name] {
			if refusal := refuseAssigneeArgs(ctx, reg, instanceID, args); refusal != nil {
				return refusal, nil
			}
		}
		if assignedToGatedTools[name] {
			if refusal := refuseAssignedToArgs(ctx, reg, instanceID, args); refusal != nil {
				return refusal, nil
			}
		}
		if name == caseVoteTool {
			pinVoterKind(args, callerAgencyRole(ctx, reg, instanceID))
		}
		if name == takeBackVoteTool {
			if refusal := refuseVoteWithdrawal(accounts.IDFromContext(ctx), callerAgencyRole(ctx, reg, instanceID), args); refusal != nil {
				return refusal, nil
			}
		}
		rest, err := json.Marshal(args)
		if err != nil {
			return toolError(err), nil
		}
		out, err := taskmanagerroutes.ToolsFor(tm, taskmanagerroutes.Mount{Caller: accounts.IDFromContext})[idx].Invoke(ctx, rest)
		if err != nil {
			return toolError(err), nil
		}
		rv := reflect.ValueOf(out)
		if rv.IsValid() && (rv.Kind() == reflect.Slice || rv.Kind() == reflect.Array) {
			return &mcp.CallToolResult{
				Content:           []mcp.Content{&mcp.TextContent{Text: fmt.Sprintf("Found %d item(s)", rv.Len())}},
				StructuredContent: map[string]any{"items": out},
			}, nil
		}
		return &mcp.CallToolResult{
			Content:           []mcp.Content{&mcp.TextContent{Text: name + " completed"}},
			StructuredContent: out,
		}, nil
	}
}

func toolError(err error) *mcp.CallToolResult {
	return &mcp.CallToolResult{IsError: true, Content: []mcp.Content{&mcp.TextContent{Text: err.Error()}}}
}
