package http

import (
	"context"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	"wakalaserver/modules/shared/dispatch"

	"wakalaserver/internal/accounts"
)

func (m *mcpServers) gateToolCalls(next mcp.MethodHandler) mcp.MethodHandler {
	return func(ctx context.Context, method string, req mcp.Request) (mcp.Result, error) {
		if method != "tools/call" || m.deps.Permissions == nil {
			return next(ctx, method, req)
		}
		params, ok := req.GetParams().(*mcp.CallToolParamsRaw)
		if !ok {
			return next(ctx, method, req)
		}

		action := m.actions.get(m.deps)[params.Name]
		if action == "" {
			return nil, dispatch.ErrForbidden
		}

		subject := accounts.IDFromContext(ctx)
		if subject == "" {
			return nil, dispatch.ErrForbidden
		}
		if scope := m.actions.scopeOf(m.deps, params.Name); scope != "" {
			if err := m.deps.authorizer(scope)(ctx, action); err != nil {
				return nil, dispatch.ErrForbidden
			}
			return next(ctx, method, req)
		}
		allowed, err := m.deps.Permissions.ActionsAnywhere(ctx, subject)
		if err != nil {
			return nil, dispatch.ErrForbidden
		}
		for _, a := range allowed {
			if a == action {
				return next(ctx, method, req)
			}
		}
		return nil, dispatch.ErrForbidden
	}
}
