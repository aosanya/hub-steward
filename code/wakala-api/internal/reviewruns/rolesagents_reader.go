package reviewruns

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"

	mwanachamaagency "wakalaserver/modules/agency"
)

var ErrRolesAgentsNoDraft = errors.New("The roles and agents cannot be read without a draft")

type RolesAgentsPermission struct {
	Code string
	Name string
}

type RolesAgentsRole struct {
	ID          string
	Code        string
	Name        string
	Description string
	Staff       bool
	Permissions []string
}

type RolesAgentsAgent struct {
	Name        string
	Description string
	RoleCode    string
	Tools       []string
}

type RolesAgentsSource interface {
	RolesAgents(ctx context.Context, draftID string) ([]RolesAgentsRole, []RolesAgentsAgent, []RolesAgentsPermission, error)
}

type RolesAgentsAgentLister func(ctx context.Context, draftID string) ([]RolesAgentsAgent, error)

type RolesAgentsManagerSource struct {
	Manager mwanachamaagency.AgencyManager
	Agents  RolesAgentsAgentLister
}

func (s RolesAgentsManagerSource) RolesAgents(ctx context.Context, draftID string) ([]RolesAgentsRole, []RolesAgentsAgent, []RolesAgentsPermission, error) {
	rows, err := s.Manager.ListRoles(ctx, draftID, mwanachamaagency.RoleFilter{})
	if err != nil {
		return nil, nil, nil, err
	}
	roles := make([]RolesAgentsRole, 0, len(rows))
	for _, r := range rows {
		roles = append(roles, RolesAgentsRole{ID: r.ID, Code: r.Code, Name: r.Name, Description: r.Description, Staff: r.Staff, Permissions: r.Permissions})
	}
	catalog, err := s.Manager.ListPermissions(ctx)
	if err != nil {
		return nil, nil, nil, err
	}
	permissions := make([]RolesAgentsPermission, 0, len(catalog))
	for _, p := range catalog {
		if p.Locked {
			continue
		}
		permissions = append(permissions, RolesAgentsPermission{Code: p.Code, Name: p.Name})
	}
	var agents []RolesAgentsAgent
	if s.Agents != nil {
		agents, err = s.Agents(ctx, draftID)
		if err != nil {
			return nil, nil, nil, err
		}
	}
	return roles, agents, permissions, nil
}

type rolesAgentsReader struct {
	source RolesAgentsSource
}

func NewRolesAgentsReader(src RolesAgentsSource) DraftReader {
	return rolesAgentsReader{source: src}
}

func (r rolesAgentsReader) Read(ctx context.Context, draftID string) (string, error) {
	if strings.TrimSpace(draftID) == "" {
		return "", ErrRolesAgentsNoDraft
	}
	roles, agents, permissions, err := r.source.RolesAgents(ctx, draftID)
	if err != nil {
		return "", fmt.Errorf("The roles and agents of this draft could not be read: %v.", err)
	}
	return RolesAgentsText(roles, agents, permissions), nil
}

func RolesAgentsText(roles []RolesAgentsRole, agents []RolesAgentsAgent, permissions []RolesAgentsPermission) string {
	var b strings.Builder
	b.WriteString("Roles:\n")
	if len(roles) == 0 {
		b.WriteString("- none\n")
	}
	names := rolesAgentsRoleNames(roles)
	for _, r := range roles {
		fmt.Fprintf(&b, "- %s %s (role_id %s)\n", r.Code, r.Name, r.ID)
		fmt.Fprintf(&b, "  description: %s\n", rolesAgentsOr(strings.TrimSpace(r.Description), "(none)"))
		fmt.Fprintf(&b, "  staff: %t\n", r.Staff)
		fmt.Fprintf(&b, "  permissions: %s\n", rolesAgentsOr(strings.Join(r.Permissions, ", "), "(none)"))
	}
	b.WriteString("\nAgents:\n")
	if len(agents) == 0 {
		b.WriteString("- none\n")
	}
	for _, a := range agents {
		fmt.Fprintf(&b, "- %s\n", a.Name)
		fmt.Fprintf(&b, "  description: %s\n", rolesAgentsOr(strings.TrimSpace(a.Description), "(none)"))
		fmt.Fprintf(&b, "  linked role: %s\n", rolesAgentsLinked(a.RoleCode, names))
		fmt.Fprintf(&b, "  tools: %s\n", rolesAgentsOr(strings.Join(a.Tools, ", "), "(none)"))
	}
	b.WriteString("\nPermission vocabulary (code: name):\n")
	if len(permissions) == 0 {
		b.WriteString("- none\n")
	}
	sorted := append([]RolesAgentsPermission(nil), permissions...)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i].Code < sorted[j].Code })
	for _, p := range sorted {
		fmt.Fprintf(&b, "- %s: %s\n", p.Code, p.Name)
	}
	return b.String()
}

func rolesAgentsRoleNames(roles []RolesAgentsRole) map[string]string {
	out := make(map[string]string, len(roles))
	for _, r := range roles {
		out[r.Code] = r.Name
	}
	return out
}

func rolesAgentsLinked(code string, names map[string]string) string {
	code = strings.TrimSpace(code)
	if code == "" {
		return "not linked"
	}
	if name, ok := names[code]; ok {
		return code + " " + name
	}
	return code + " (no such role in this draft)"
}

func rolesAgentsOr(text, fallback string) string {
	if text == "" {
		return fallback
	}
	return text
}
