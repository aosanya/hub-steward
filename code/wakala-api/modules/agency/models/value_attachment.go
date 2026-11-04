package models

// ValueAttachment links a Value to one target — a Role, Goal, Objective,
// Workflow, or WorkItem — scoping what would otherwise be an Agency-wide
// statement. A Value may carry several attachments at once, to different
// targets or the same type of target. AGD-003 (2026-09-15).
//
// Referenced by Code, not row id, on both sides — deliberately: a Value
// and every attachable target type mint a brand-new row id on every Draft
// promotion (see [Role]'s own doc comment), but Code survives that churn
// unchanged. An attachment keyed by row id would silently go stale the
// next time anyone promotes any Draft touching either side; Code doesn't.
// Attaching/detaching is live-editable — it never goes through the Draft
// fork/edit/promote cycle a Value's own Text does.
type ValueAttachment struct {
	ID         string     `json:"id"`
	ValueCode  string     `json:"value_code"`
	TargetType TargetType `json:"target_type"`
	TargetCode string     `json:"target_code"`
	CreatedAt  string     `json:"created_at"`
}
