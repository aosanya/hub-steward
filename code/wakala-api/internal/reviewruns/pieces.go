package reviewruns

import (
	"context"
	"errors"

	mwanachamaagency "wakalaserver/modules/agency"
	mwanachamaai "wakalaserver/modules/ai"
)

var errNoAIBackend = errors.New("The review has no AI backend on this server")

type Pieces struct {
	AI     func(ctx context.Context, instanceID string) (mwanachamaai.Manager, error)
	Agency func(ctx context.Context, instanceID string) (mwanachamaagency.AgencyManager, error)
	Kind   func(ctx context.Context, instanceID string) (string, error)
}

func (p Pieces) For(ctx context.Context, instanceID string) (Roster, error) {
	if p.AI == nil {
		return Roster{}, errNoAIBackend
	}
	ai, err := p.AI(ctx, instanceID)
	if err != nil {
		return Roster{}, err
	}
	agency, err := p.Agency(ctx, instanceID)
	if err != nil {
		return Roster{}, err
	}
	kind, err := p.Kind(ctx, instanceID)
	if err != nil {
		return Roster{}, err
	}
	model := AIModel{Manager: ai, AgencyID: instanceID, Person: StartedByFrom(ctx)}
	roster := Roster{Reviewers: map[string]Reviewer{}, Unavailable: map[string]string{}}
	add := func(r Reviewer) { roster.Reviewers[r.Area()] = r }
	add(NewProfileReviewer(model, NewProfileReader(NewProfileManagerSource(agency))))
	add(NewGoalsReviewer(model, NewGoalsReader(NewGoalsManagerSource(agency))))
	add(NewWorkflowsReviewer(model, NewWorkflowsReader(agency)))
	add(NewRolesAgentsReviewer(model, NewRolesAgentsReader(RolesAgentsManagerSource{Manager: agency, Agents: NewAIRoleAgentLister(ai, agency, instanceID)})))
	add(NewTestsReviewer(model, NewTestsReader(NewTestsAgencySource(agency))))
	p.addObjectives(roster, kind, model, agency)
	add(NewRisksReviewer(model, NewRisksReader(NewRisksAgencySource(agency))))
	return roster, nil
}

func (p Pieces) addObjectives(roster Roster, kind string, model Model, agency ObjectivesAgency) {
	if !AreaApplies(kind, AreaObjectives) {
		roster.Unavailable[AreaObjectives] = objectivesNotApplicable
		return
	}
	roster.Reviewers[AreaObjectives] = NewObjectivesReviewer(model, NewObjectivesReader(agency))
}
