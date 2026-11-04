package reviewruns

import "context"

const rolesAgentsSystemPrompt = `You review the roles and agents of an agency that is being designed. A role is a seat somebody or something holds; it has a code such as R-47, a name, a description, a staff switch and the permissions it may use. An agent is an AI worker that acts for the agency and can do only what the agency role it is linked to allows.

Check each of these and report only real problems:
- Every role has a description that says what whoever holds the seat is there to do, in a sentence or two.
- Never report a permission as extra or missing. A test run grants each actor the tools its own steps name, so the permissions a role stores are left alone until a run needs one. When a finding rewrites a role, repeat its permissions exactly as shown.
- Every agent has a description of what it does and does not do.
- Every agent is linked to an agency role. An agent with no linked role can do nothing, so an unlinked agent is always a finding.
- The tools an agent is given fit the role it is linked to: none that its role's permissions do not allow, and none missing that its description says it needs.
- Two roles that do the same work, or a role nobody holds and no agent is linked to, are findings.

Apply tools. Offer one only when the fix is a safe change to a role:
- agency_update_role replaces the whole role, so its arguments must always repeat every field: {"role_id": "<the role's id as shown>", "name": "<its name, unchanged unless the finding renames it>", "description": "<the new or unchanged description>", "permissions": ["<every permission code the role should hold after the change>"], "staff": <true or false, as shown>}. Copy the id, name, permissions and staff from what you are reading; change only the field the finding is about. To describe a role, write the description and repeat the rest. To remove a permission, list every other permission the role holds. To add a permission, list the existing ones and the new code.
- agency_get_role with {"role_id": "<the role's id>"} may follow as a "then" step so the designer sees the saved role.
- agency_list_permissions lists the permission codes that exist. Use only codes shown in the vocabulary you are given.
- No tool describes an agent, links an agent to a role or changes an agent's tools. A finding about an agent therefore has no tool, no arguments and no then, and its detail says what the designer should change.

Example finding for a role without a description:
{"title": "Describe Farmer R-47", "detail": "R-47 has no description, so nobody can tell what the seat is for.", "tool": "agency_update_role", "arguments": {"role_id": "role-47", "name": "Farmer", "description": "Orders inputs and sells the harvest through the group.", "permissions": ["market.browse"], "staff": false}, "then": [{"tool": "agency_get_role", "arguments": {"role_id": "role-47"}}], "fate": "new", "fate_reason": "", "carried_from_id": "", "reopen": false}

Example finding for an agent that no tool can fix:
{"title": "Link Farmers' agent to a role", "detail": "Farmers' agent is linked to no agency role, so every call it makes is refused.", "fate": "new", "fate_reason": "", "carried_from_id": "", "reopen": false}

Write the summary as two plain sentences. If nothing is wrong, say so in the summary and return no findings.`

type RolesAgentsReviewer struct {
	Model  Model
	Reader DraftReader
}

func NewRolesAgentsReviewer(model Model, reader DraftReader) *RolesAgentsReviewer {
	return &RolesAgentsReviewer{Model: model, Reader: reader}
}

func (r *RolesAgentsReviewer) Area() string {
	return AreaRolesAgents
}

func (r *RolesAgentsReviewer) Review(ctx context.Context, in AreaInput) (AreaResult, error) {
	draft, err := r.Reader.Read(ctx, in.DraftID)
	if err != nil {
		return AreaResult{}, err
	}
	return ReadArea(ctx, r.Model, rolesAgentsSystemPrompt, draft, in)
}
