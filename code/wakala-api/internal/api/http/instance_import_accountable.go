package http

const accountableLabel = "accountable"

func (in importRequest) withAccountableRolesFolded() importRequest {
	if len(in.RoleAssignments) == 0 {
		return in
	}
	stepAt := make(map[string]int, len(in.WorkItems))
	for i, step := range in.WorkItems {
		stepAt[step.ID] = i
	}
	known := make(map[string]bool, len(in.Roles))
	for _, role := range in.Roles {
		known[role.ID] = true
	}
	steps := append([]importWorkItem(nil), in.WorkItems...)
	for _, entry := range in.RoleAssignments {
		at, onAStep := stepAt[entry.WorkItemID]
		if entry.WorkItemID == "" || !onAStep || !known[entry.RoleID] || entry.Label != accountableLabel {
			continue
		}
		step := &steps[at]
		if step.AccountableRoleID != "" || step.RoleID == entry.RoleID {
			continue
		}
		step.AccountableRoleID = entry.RoleID
	}
	in.WorkItems = steps
	in.RoleAssignments = nil
	return in
}
