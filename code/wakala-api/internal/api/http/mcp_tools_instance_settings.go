package http

import (
	"context"
	"errors"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	"wakalaserver/internal/agencies"
	"wakalaserver/internal/languages"
)

var errLanguagesUnavailable = errors.New("languages are not available")

type mcpJoinModeParams struct {
	InstanceID string `json:"instance_id" jsonschema:"the Agency Instance"`
}

type mcpSetJoinModeParams struct {
	InstanceID string `json:"instance_id" jsonschema:"the Agency Instance"`
	JoinMode   string `json:"join_mode" jsonschema:"open or confirmed"`
}

type mcpRenameParams struct {
	InstanceID string `json:"instance_id" jsonschema:"the Agency Instance"`
	Name       string `json:"name" jsonschema:"the new name, 1 to 120 characters"`
}

type mcpRenamed struct {
	InstanceID string `json:"instance_id"`
	Name       string `json:"name"`
}

type mcpJoinMode struct {
	InstanceID string `json:"instance_id"`
	JoinMode   string `json:"join_mode"`
}

type mcpLanguagesParams struct {
	InstanceID string `json:"instance_id" jsonschema:"the Agency Instance"`
}

type mcpSetLanguagesParams struct {
	InstanceID     string   `json:"instance_id" jsonschema:"the Agency Instance"`
	StudioDefault  string   `json:"studio_default" jsonschema:"the language the studio opens in"`
	Content        []string `json:"content" jsonschema:"the languages the agency offers its content in"`
	ContentDefault string   `json:"content_default" jsonschema:"the default content language, one of content"`
}

func (d *Deps) registerInstanceSettingsMCPTools(server *mcp.Server) {
	mcp.AddTool(server, &mcp.Tool{Name: "instance_get_join_mode", Title: "Get Join Mode", Description: "Read whether people join an Agency Instance at once (open) or by request (confirmed). Members only."}, d.mcpGetJoinMode)
	mcp.AddTool(server, &mcp.Tool{Name: "instance_set_join_mode", Title: "Set Join Mode", Description: "Set whether people join an Agency Instance at once (open) or by request (confirmed). Members only."}, d.mcpSetJoinMode)
	mcp.AddTool(server, &mcp.Tool{Name: "instance_rename", Title: "Rename Agency", Description: "Rename an Agency Instance in the hub list. Members only."}, d.mcpRenameInstance)
	mcp.AddTool(server, &mcp.Tool{Name: "instance_get_languages", Title: "Get Languages", Description: "Read an Agency Instance's studio default language, offered content languages and default content language. Open to every person admitted to the agency: its owner, its agents and its residents."}, d.mcpGetLanguages)
	mcp.AddTool(server, &mcp.Tool{Name: "instance_set_languages", Title: "Set Languages", Description: "Owner only: set an Agency Instance's studio default language, offered content languages and default content language."}, d.mcpSetLanguages)
}

func (d *Deps) mcpGetJoinMode(ctx context.Context, _ *mcp.CallToolRequest, p mcpJoinModeParams) (*mcp.CallToolResult, mcpJoinMode, error) {
	if err := mustBeMember(ctx, d.Registry, p.InstanceID); err != nil {
		return nil, mcpJoinMode{}, err
	}
	inst, err := d.Registry.GetInstance(ctx, p.InstanceID)
	if err != nil {
		return nil, mcpJoinMode{}, err
	}
	return textResult("Agency %s join mode is %s", inst.ID, inst.JoinMode), mcpJoinMode{InstanceID: inst.ID, JoinMode: inst.JoinMode}, nil
}

func (d *Deps) mcpSetJoinMode(ctx context.Context, _ *mcp.CallToolRequest, p mcpSetJoinModeParams) (*mcp.CallToolResult, mcpJoinMode, error) {
	if err := mustBeMember(ctx, d.Registry, p.InstanceID); err != nil {
		return nil, mcpJoinMode{}, err
	}
	inst, err := d.Registry.SetJoinMode(ctx, p.InstanceID, p.JoinMode)
	if err != nil {
		return nil, mcpJoinMode{}, err
	}
	return textResult("Agency %s join mode set to %s", inst.ID, inst.JoinMode), mcpJoinMode{InstanceID: inst.ID, JoinMode: inst.JoinMode}, nil
}

func (d *Deps) mcpRenameInstance(ctx context.Context, _ *mcp.CallToolRequest, p mcpRenameParams) (*mcp.CallToolResult, mcpRenamed, error) {
	if err := mustBeMember(ctx, d.Registry, p.InstanceID); err != nil {
		return nil, mcpRenamed{}, err
	}
	inst, err := d.Registry.RenameInstance(ctx, p.InstanceID, p.Name)
	if err != nil {
		return nil, mcpRenamed{}, err
	}
	return textResult("Agency %s renamed to %s", inst.ID, inst.Name), mcpRenamed{InstanceID: inst.ID, Name: inst.Name}, nil
}

func (d *Deps) mcpGetLanguages(ctx context.Context, _ *mcp.CallToolRequest, p mcpLanguagesParams) (*mcp.CallToolResult, languages.Agency, error) {
	if d.Languages == nil {
		return nil, languages.Agency{}, errLanguagesUnavailable
	}
	if _, err := admittedRole(ctx, d.Registry, p.InstanceID); err != nil {
		return nil, languages.Agency{}, err
	}
	a, err := d.Languages.Agency(ctx, p.InstanceID)
	if err != nil {
		return nil, languages.Agency{}, namedLanguageFailure(err, errLanguagesNotRead)
	}
	return textResult("Agency %s offers %d content language(s), studio default %s", p.InstanceID, len(a.Content), a.StudioDefault), a, nil
}

func (d *Deps) mcpSetLanguages(ctx context.Context, _ *mcp.CallToolRequest, p mcpSetLanguagesParams) (*mcp.CallToolResult, languages.Agency, error) {
	if d.Languages == nil {
		return nil, languages.Agency{}, errLanguagesUnavailable
	}
	a, err := putLanguagesAsOwner(ctx, d.Registry, d.Languages, p.InstanceID, languages.Agency{StudioDefault: p.StudioDefault, Content: p.Content, ContentDefault: p.ContentDefault})
	if err != nil {
		return nil, languages.Agency{}, err
	}
	return textResult("Agency %s languages saved: %d content language(s), studio default %s", p.InstanceID, len(a.Content), a.StudioDefault), a, nil
}

func putLanguagesAsOwner(ctx context.Context, reg agencies.Registry, store *languages.Store, instanceID string, a languages.Agency) (languages.Agency, error) {
	if store == nil {
		return languages.Agency{}, errLanguagesUnavailable
	}
	role, err := admittedRole(ctx, reg, instanceID)
	if err != nil {
		return languages.Agency{}, err
	}
	if role != agencies.RoleOwner {
		return languages.Agency{}, agencies.ErrInstanceNotFound
	}
	saved, err := store.PutAgency(ctx, instanceID, a)
	if err != nil {
		return languages.Agency{}, namedLanguageFailure(err, errLanguagesNotSaved)
	}
	return saved, nil
}
