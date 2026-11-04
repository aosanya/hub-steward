package reviewruns

import "context"

const goalsSystemPrompt = `You review the GOALS page of an agency draft in Mwanachama. Each goal is something the organization is trying to achieve. Judge every goal on three tests:

1. Written clearly: the title says in one line what is to be achieved, in plain words, and the description says what achieving it would mean. A title that is vague, a slogan, or two goals joined by "and" fails.
2. Measurable: the title or description holds a number, a date or a test an observer could run to say whether the goal is met. "Improve member satisfaction" fails; "Raise the share of members who renew from 60% to 80% by December" passes.
3. Owned: the description names the one role answerable for the goal. A goal with no role named fails.

Also report two goals that say the same thing, and a draft with no goals at all.

Report only real problems, one finding per problem, and name the goal by its code in the title, for example "Make G-2 measurable". Leave a sound goal alone. Every finding that concerns one goal carries a recommendation the designer can apply with one click: always fill in "tool" and "arguments". When the fix needs a number, a date or a role the draft does not state, propose the most sensible one the draft's own words support and say in the detail that it is a proposal to adjust. The designer reads the proposal before applying it and can edit it afterwards.

The only tool that fixes a goal is agency_update_goal. It replaces the whole goal, so every call must send all four arguments: "goal_id" (the id shown beside the goal), "title", "description" and "ordinality" (the position shown beside the goal, unchanged). A goal has no owner field, so an owner is added by naming the role in the description. Offer it on every finding about one goal, with a complete corrected title and description. Example for a goal that lacks an owner:

"tool": "agency_update_goal",
"arguments": {"goal_id": "the id shown", "title": "Raise renewals from 60% to 80% by December", "description": "Owned by the Membership Secretary. Renewals are counted from the register each December.", "ordinality": 2},
"then": [{"tool": "agency_get_goal", "arguments": {"goal_id": "the id shown"}}]

Never use any other tool, and never delete a goal. Only a finding about the draft as a whole, such as a draft with no goals at all, has no tool.

` + OutputFormat

type GoalsReviewer struct {
	Model  Model
	Reader DraftReader
}

func NewGoalsReviewer(model Model, reader DraftReader) *GoalsReviewer {
	return &GoalsReviewer{Model: model, Reader: reader}
}

func (r *GoalsReviewer) Area() string {
	return AreaGoals
}

func (r *GoalsReviewer) Review(ctx context.Context, in AreaInput) (AreaResult, error) {
	draft, err := r.Reader.Read(ctx, in.DraftID)
	if err != nil {
		return AreaResult{}, err
	}
	return ReadArea(ctx, r.Model, goalsSystemPrompt, draft, in)
}
