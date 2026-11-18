package http

import (
	"context"
	"encoding/json"
	"log/slog"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	"wakalaserver/internal/accounts"
)

type auditedWrite struct {
	action   string
	actionOf func(args map[string]any) string
	subject  func(args, result map[string]any) string
}

func (w auditedWrite) actionFor(args map[string]any) string {
	if w.actionOf != nil {
		return w.actionOf(args)
	}
	return w.action
}

func rowAction(args map[string]any) string {
	if fieldOf(args, "replaces") != "" {
		return "corrected a row"
	}
	return "added a row"
}

func fieldOf(source map[string]any, key string) string {
	value, _ := source[key].(string)
	return value
}

func auditedWrites() map[string]auditedWrite {
	return map[string]auditedWrite{
		"instance_rename": {
			action:  "renamed the agency",
			subject: func(args, result map[string]any) string { return fieldOf(result, "name") },
		},
		"actor_grant_role": {
			action:  "granted a role",
			subject: func(args, result map[string]any) string { return fieldOf(args, "actor_id") },
		},
		"forms_form_publish": {
			action:  "published a form",
			subject: func(args, result map[string]any) string { return fieldOf(args, "form_id") },
		},
		addLiveRecordRowTool: {
			actionOf: rowAction,
			subject:  func(args, result map[string]any) string { return fieldOf(result, "id") },
		},
	}
}

func (d *Deps) recordAuditedWrites(next mcp.MethodHandler) mcp.MethodHandler {
	writes := auditedWrites()
	return func(ctx context.Context, method string, req mcp.Request) (mcp.Result, error) {
		result, err := next(ctx, method, req)
		call, ok := req.(*mcp.CallToolRequest)
		if !ok || method != "tools/call" || call.Params == nil || err != nil || d.Audit == nil {
			return result, err
		}
		write, audited := writes[call.Params.Name]
		if !audited {
			return result, err
		}
		answer, ok := result.(*mcp.CallToolResult)
		if !ok || answer == nil || answer.IsError {
			return result, err
		}
		args := jsonObject(call.Params.Arguments)
		instanceID := fieldOf(args, "instance_id")
		if instanceID == "" {
			return result, err
		}
		subject := write.subject(args, structuredObject(answer.StructuredContent))
		if _, recordErr := d.Audit.Record(ctx, instanceID, accounts.IDFromContext(ctx), write.actionFor(args), subject); recordErr != nil {
			slog.Warn("an audited write left no audit entry", "tool", call.Params.Name, "instance", instanceID, "err", recordErr)
		}
		return result, err
	}
}

func jsonObject(raw []byte) map[string]any {
	out := map[string]any{}
	_ = json.Unmarshal(raw, &out)
	return out
}

func structuredObject(content any) map[string]any {
	encoded, err := json.Marshal(content)
	if err != nil {
		return map[string]any{}
	}
	return jsonObject(encoded)
}
