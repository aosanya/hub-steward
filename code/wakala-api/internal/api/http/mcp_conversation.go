package http

import (
	"context"
	"fmt"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	"wakalaserver/modules/shared/dispatch"
)

func conversationPerToolCall(next mcp.MethodHandler) mcp.MethodHandler {
	return func(ctx context.Context, method string, req mcp.Request) (mcp.Result, error) {
		call, ok := req.(*mcp.CallToolRequest)
		if method != "tools/call" || !ok || call.Params == nil {
			return next(ctx, method, req)
		}
		id, err := conversationIn(call.Params.Meta)
		if err != nil {
			return toolText(err.Error(), true), nil
		}
		return next(dispatch.WithConversation(ctx, id), method, req)
	}
}

func conversationIn(meta map[string]any) (string, error) {
	raw, present := meta[dispatch.ConversationMetaKey]
	if !present || raw == nil {
		return "", nil
	}
	id, isText := raw.(string)
	if !isText || (id != "" && !dispatch.ConversationPattern.MatchString(id)) {
		return "", fmt.Errorf("_meta.%s %w", dispatch.ConversationMetaKey, dispatch.ErrInvalidConversation)
	}
	return id, nil
}
