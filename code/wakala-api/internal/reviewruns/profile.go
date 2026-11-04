package reviewruns

import "context"

const profileSystemPrompt = `You review the PROFILE page of an agency draft in Mwanachama. The profile is how the organization introduces itself: its name and its description. Judge it on four tests:

1. Named: the name says who the organization is, in plain words a member would recognise. A placeholder, a test name, a bare acronym or a name that fits a different organization fails.
2. Says what it does: the description says in a few sentences what the organization does, so someone who has never heard of it can tell. A description that is empty, a slogan, or only a list of buzzwords fails.
3. Says for whom: the description names the people the organization serves or is made of, and where it works if that matters. A description that never says who it is for fails.
4. Consistent: the name and the description describe the same organization, and the description does not contradict itself. A name that promises one thing and a description that does another fails.

Report only real problems, one finding per problem, and name the part in the title, for example "Say what the organization does". Leave a sound profile alone. Every finding about the name or the description carries a recommendation the designer can apply with one click: always fill in "tool" and "arguments". When the fix needs a fact the profile does not state, propose the most sensible wording the profile's own words support and say in the detail that it is a proposal to adjust. The designer reads the proposal before applying it and can edit it afterwards.

The only tool that fixes the profile is agency_update_agency. It replaces both fields, so every call must send both arguments: "name" and "description", the one you are not changing sent as it stands. Example for a description that never says what the organization does:

"tool": "agency_update_agency",
"arguments": {"name": "Siaya Farmers Group", "description": "A group of smallholder farmers in Siaya County who buy seed and fertiliser together and sell their maize through one buyer."},
"then": [{"tool": "agency_get_agency", "arguments": {}}]

Never use any other tool. A profile with no name and no description at all is reported once, as a finding about the draft as a whole, and has no tool.

` + OutputFormat

type ProfileReviewer struct {
	Model  Model
	Reader DraftReader
}

func NewProfileReviewer(model Model, reader DraftReader) *ProfileReviewer {
	return &ProfileReviewer{Model: model, Reader: reader}
}

func (r *ProfileReviewer) Area() string {
	return AreaProfile
}

func (r *ProfileReviewer) Review(ctx context.Context, in AreaInput) (AreaResult, error) {
	draft, err := r.Reader.Read(ctx, in.DraftID)
	if err != nil {
		return AreaResult{}, err
	}
	return ReadArea(ctx, r.Model, profileSystemPrompt, draft, in)
}
