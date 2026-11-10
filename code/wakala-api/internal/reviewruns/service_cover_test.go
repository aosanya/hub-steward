package reviewruns

import (
	"context"
	"errors"
	"strings"
	"testing"

	mwanachamaagency "wakalaserver/modules/agency"
	"wakalaserver/modules/agency/models"
	mwanachamaai "wakalaserver/modules/ai"
	aimodels "wakalaserver/modules/ai/models"
)

func TestRosterExplainsAnAreaWithNoReviewer(t *testing.T) {
	roster := Roster{Reviewers: map[string]Reviewer{AreaGoals: nil}, Unavailable: map[string]string{AreaObjectives: "Only farms.", AreaRisks: ""}}
	if r, why := roster.reviewerFor(AreaObjectives); r != nil || why != "Only farms." {
		t.Errorf("objectives = %v %q", r, why)
	}
	if r, why := roster.reviewerFor(AreaRisks); r != nil || why != noReviewerSentence {
		t.Errorf("empty reason = %v %q", r, why)
	}
	if r, why := roster.reviewerFor(AreaGoals); r != nil || why != noReviewerSentence {
		t.Errorf("nil reviewer = %v %q", r, why)
	}
	known := Roster{Reviewers: map[string]Reviewer{AreaTests: &stubReviewer{area: AreaTests}}}
	if r, why := known.reviewerFor(AreaTests); r == nil || why != "" {
		t.Errorf("tests = %v %q", r, why)
	}
}

type fakeRolesAgency struct {
	mwanachamaagency.AgencyManager
	roles       []models.Role
	rolesErr    error
	permissions []models.Permission
	permErr     error
}

func (f fakeRolesAgency) ListRoles(context.Context, string, mwanachamaagency.RoleFilter) ([]models.Role, error) {
	return f.roles, f.rolesErr
}

func (f fakeRolesAgency) ListPermissions(context.Context) ([]models.Permission, error) {
	return f.permissions, f.permErr
}

func TestRolesAgentsSourceHidesLockedPermissionsAndAddsListedAgents(t *testing.T) {
	agency := fakeRolesAgency{
		roles:       []models.Role{{ID: "r1", Code: "R-1", Name: "Secretary", Description: "Keeps minutes", Staff: true, Permissions: []string{"form.read"}}},
		permissions: []models.Permission{{Code: "form.read", Name: "Read forms"}, {Code: "root.all", Name: "Everything", Locked: true}},
	}
	source := RolesAgentsManagerSource{Manager: agency, Agents: func(context.Context, string) ([]RolesAgentsAgent, error) {
		return []RolesAgentsAgent{{Name: "Helper", RoleCode: "R-1"}}, nil
	}}
	roles, agents, permissions, err := source.RolesAgents(context.Background(), "d1")
	if err != nil {
		t.Fatal(err)
	}
	if len(roles) != 1 || roles[0].Name != "Secretary" || !roles[0].Staff || len(agents) != 1 {
		t.Errorf("roles %+v agents %+v", roles, agents)
	}
	if len(permissions) != 1 || permissions[0].Code != "form.read" {
		t.Errorf("permissions = %+v, the locked one must be hidden", permissions)
	}
}

func TestRolesAgentsSourceWorksWithoutAnAgentLister(t *testing.T) {
	_, agents, _, err := RolesAgentsManagerSource{Manager: fakeRolesAgency{}}.RolesAgents(context.Background(), "d1")
	if err != nil || agents != nil {
		t.Errorf("agents %v err %v", agents, err)
	}
}

func TestRolesAgentsSourcePassesEachErrorOn(t *testing.T) {
	boom := errors.New("down")
	lister := func(context.Context, string) ([]RolesAgentsAgent, error) { return nil, boom }
	cases := map[string]RolesAgentsManagerSource{
		"roles":       {Manager: fakeRolesAgency{rolesErr: boom}},
		"permissions": {Manager: fakeRolesAgency{permErr: boom}},
		"agents":      {Manager: fakeRolesAgency{}, Agents: lister},
	}
	for name, source := range cases {
		if _, _, _, err := source.RolesAgents(context.Background(), "d1"); !errors.Is(err, boom) {
			t.Errorf("%s: err = %v", name, err)
		}
	}
}

func TestRolesAgentsReaderNeedsADraftAndWrapsFailures(t *testing.T) {
	reader := NewRolesAgentsReader(RolesAgentsManagerSource{Manager: fakeRolesAgency{rolesErr: errors.New("down")}})
	if _, err := reader.Read(context.Background(), "  "); !errors.Is(err, ErrRolesAgentsNoDraft) {
		t.Errorf("blank draft err = %v", err)
	}
	_, err := reader.Read(context.Background(), "d1")
	if err == nil || err.Error() != "The roles and agents of this draft could not be read: down." {
		t.Errorf("err = %v", err)
	}
}

func TestRolesAgentsTextLinksAgentsToRolesAndSortsPermissions(t *testing.T) {
	text := RolesAgentsText(
		[]RolesAgentsRole{{ID: "r1", Code: "R-1", Name: "Secretary", Permissions: []string{"a", "b"}}},
		[]RolesAgentsAgent{
			{Name: "Linked", Description: "Writes", RoleCode: "R-1", Tools: []string{"t1", "t2"}},
			{Name: "Lost", RoleCode: "R-9"},
			{Name: "Free"},
		},
		[]RolesAgentsPermission{{Code: "z.do", Name: "Z"}, {Code: "a.do", Name: "A"}},
	)
	for _, want := range []string{
		"- R-1 Secretary (role_id r1)\n  description: (none)\n  staff: false\n  permissions: a, b\n",
		"linked role: R-1 Secretary",
		"linked role: R-9 (no such role in this draft)",
		"linked role: not linked",
		"tools: t1, t2",
		"description: Writes",
		"tools: (none)",
	} {
		if !strings.Contains(text, want) {
			t.Errorf("missing %q in\n%s", want, text)
		}
	}
	if strings.Index(text, "- a.do: A") > strings.Index(text, "- z.do: Z") || !strings.Contains(text, "- a.do: A") {
		t.Errorf("permissions not sorted:\n%s", text)
	}
}

func TestRolesAgentsTextSaysNoneForEachEmptySection(t *testing.T) {
	text := RolesAgentsText(nil, nil, nil)
	if strings.Count(text, "- none\n") != 3 {
		t.Errorf("text = %q", text)
	}
}

type fakeRoleLists struct {
	held       []aimodels.AIRole
	heldErr    error
	seats      []models.Role
	seatErr    error
	seatsAsked bool
}

func (f *fakeRoleLists) ListAIRoles(context.Context, string) ([]aimodels.AIRole, error) {
	return f.held, f.heldErr
}

func (f *fakeRoleLists) ListRoles(context.Context, string, mwanachamaagency.RoleFilter) ([]models.Role, error) {
	f.seatsAsked = true
	return f.seats, f.seatErr
}

func TestAIRoleAgentListerNamesTheSeatEachAgentBelongsTo(t *testing.T) {
	lists := &fakeRoleLists{
		held:  []aimodels.AIRole{{Name: "Helper", Description: "Helps", AgencyRoleID: "r1"}, {Name: "Stray", AgencyRoleID: "gone"}},
		seats: []models.Role{{ID: "r1", Code: "R-1"}},
	}
	agents, err := NewAIRoleAgentLister(lists, lists, "ag")(context.Background(), "d1")
	if err != nil {
		t.Fatal(err)
	}
	if len(agents) != 2 || agents[0].RoleCode != "R-1" || agents[0].Description != "Helps" || agents[1].RoleCode != "" {
		t.Errorf("agents = %+v", agents)
	}
}

func TestAIRoleAgentListerSkipsTheSeatLookupWhenThereAreNoAgents(t *testing.T) {
	lists := &fakeRoleLists{}
	agents, err := NewAIRoleAgentLister(lists, lists, "ag")(context.Background(), "d1")
	if err != nil || agents != nil || lists.seatsAsked {
		t.Errorf("agents %v err %v seatsAsked %v", agents, err, lists.seatsAsked)
	}
}

func TestAIRoleAgentListerPassesEachErrorOn(t *testing.T) {
	boom := errors.New("down")
	held := []aimodels.AIRole{{Name: "H"}}
	for name, lists := range map[string]*fakeRoleLists{"roles": {heldErr: boom}, "seats": {held: held, seatErr: boom}} {
		if _, err := NewAIRoleAgentLister(lists, lists, "ag")(context.Background(), "d1"); !errors.Is(err, boom) {
			t.Errorf("%s: err = %v", name, err)
		}
	}
}

func piecesFor(kind string) Pieces {
	return Pieces{
		AI:     func(context.Context, string) (mwanachamaai.Manager, error) { return &fakeManager{}, nil },
		Agency: func(context.Context, string) (mwanachamaagency.AgencyManager, error) { return fakeAgency{}, nil },
		Kind:   func(context.Context, string) (string, error) { return kind, nil },
	}
}

func TestPiecesBuildAReviewerForEachAreaAndHoldBackObjectivesOutsideFarming(t *testing.T) {
	roster, err := piecesFor("town hall").For(context.Background(), "ag")
	if err != nil {
		t.Fatal(err)
	}
	for _, area := range AreasFor("town hall") {
		if r, _ := roster.reviewerFor(area); r == nil {
			t.Errorf("no reviewer for %s", area)
		}
	}
	if r, why := roster.reviewerFor(AreaObjectives); r != nil || why != objectivesNotApplicable {
		t.Errorf("objectives = %v %q", r, why)
	}
	farm, err := piecesFor("Farmers co-op").For(context.Background(), "ag")
	if err != nil {
		t.Fatal(err)
	}
	if r, _ := farm.reviewerFor(AreaObjectives); r == nil {
		t.Error("a farm needs an objectives reviewer")
	}
}

func TestPiecesFailWithoutAnAIBackendAndOnEachLookupError(t *testing.T) {
	if _, err := (Pieces{}).For(context.Background(), "ag"); !errors.Is(err, errNoAIBackend) {
		t.Errorf("no AI err = %v", err)
	}
	boom := errors.New("down")
	broken := map[string]func(Pieces) Pieces{
		"ai": func(p Pieces) Pieces {
			p.AI = func(context.Context, string) (mwanachamaai.Manager, error) { return nil, boom }
			return p
		},
		"agency": func(p Pieces) Pieces {
			p.Agency = func(context.Context, string) (mwanachamaagency.AgencyManager, error) { return nil, boom }
			return p
		},
		"kind": func(p Pieces) Pieces {
			p.Kind = func(context.Context, string) (string, error) { return "", boom }
			return p
		},
	}
	for name, breakIt := range broken {
		if _, err := breakIt(piecesFor("x")).For(context.Background(), "ag"); !errors.Is(err, boom) {
			t.Errorf("%s: err = %v", name, err)
		}
	}
}

func TestDefaultAccountCheckReportsAMissingDefaultInTheReviewsOwnWords(t *testing.T) {
	if err := DefaultAccountCheck(nil)(context.Background(), "ag"); !errors.Is(err, ErrNoDefaultAccount) {
		t.Errorf("nil resolver err = %v", err)
	}
	resolve := func(m *fakeManager) AIResolver {
		return func(context.Context, string) (mwanachamaai.Manager, error) { return m, nil }
	}
	if err := DefaultAccountCheck(resolve(&fakeManager{accountErr: mwanachamaai.ErrNoDefaultAccount}))(context.Background(), "ag"); !errors.Is(err, ErrNoDefaultAccount) {
		t.Errorf("missing default err = %v", err)
	}
	boom := errors.New("down")
	if err := DefaultAccountCheck(resolve(&fakeManager{accountErr: boom}))(context.Background(), "ag"); !errors.Is(err, boom) {
		t.Errorf("other err = %v", err)
	}
	if err := DefaultAccountCheck(resolve(&fakeManager{}))(context.Background(), "ag"); err != nil {
		t.Errorf("ok err = %v", err)
	}
	failing := func(context.Context, string) (mwanachamaai.Manager, error) { return nil, boom }
	if err := DefaultAccountCheck(failing)(context.Background(), "ag"); !errors.Is(err, boom) {
		t.Errorf("resolve err = %v", err)
	}
}

func serviceFor(tools *fakeTools, account AccountCheck, reviewer Reviewer) (*Service, *Runner) {
	runner := NewRunner(tools, rosterOf(reviewer), quiet())
	return &Service{Tools: tools, Account: account, Runner: runner}, runner
}

func TestServiceStartLaunchesTheReviewAfterTheAccountCheckPasses(t *testing.T) {
	tools := &fakeTools{started: pageReading(AreaGoals)}
	service, runner := serviceFor(tools, func(context.Context, string) error { return nil }, &stubReviewer{area: AreaGoals, result: AreaResult{Summary: "ok"}})
	page, err := service.Start(context.Background(), "ag", "dr1", "amina", AreaGoals)
	if err != nil {
		t.Fatal(err)
	}
	runner.Wait()
	if page.Review.ID != "rv1" || strings.Join(tools.startedWith, "|") != "ag|dr1|amina|goals" {
		t.Errorf("page %+v started with %v", page, tools.startedWith)
	}
	if got := tools.byArea(AreaGoals); len(got) != 1 || got[0]["status"] != "done" {
		t.Errorf("recorded %v", got)
	}
}

func TestServiceStartStopsBeforeAnyReviewWhenTheCheckOrTheHubRefuses(t *testing.T) {
	tools := &fakeTools{}
	service, _ := serviceFor(tools, func(context.Context, string) error { return ErrNoDefaultAccount }, &stubReviewer{area: AreaGoals})
	if _, err := service.Start(context.Background(), "ag", "d", "p", ""); !errors.Is(err, ErrNoDefaultAccount) {
		t.Errorf("account err = %v", err)
	}
	if tools.startedWith != nil {
		t.Error("a review was started without a default account")
	}
	tools = &fakeTools{startErr: ErrReviewAlreadyRuns}
	service, _ = serviceFor(tools, func(context.Context, string) error { return nil }, &stubReviewer{area: AreaGoals})
	if _, err := service.Start(context.Background(), "ag", "d", "p", ""); !errors.Is(err, ErrReviewAlreadyRuns) {
		t.Errorf("start err = %v", err)
	}
}

func TestServiceResumeRelaunchesEveryRunningReview(t *testing.T) {
	tools := &fakeTools{running: []Running{{InstanceID: "ag1", Page: pageReading(AreaGoals)}, {InstanceID: "ag2", Page: pageReading(AreaProfile)}}}
	runner := NewRunner(tools, rosterOf(&stubReviewer{area: AreaGoals, result: AreaResult{Summary: "g"}}, &stubReviewer{area: AreaProfile, result: AreaResult{Summary: "p"}}), quiet())
	service := &Service{Tools: tools, Runner: runner}
	if err := service.Resume(context.Background()); err != nil {
		t.Fatal(err)
	}
	runner.Wait()
	if len(tools.byArea(AreaGoals)) != 1 || len(tools.byArea(AreaProfile)) != 1 {
		t.Errorf("recorded %v", tools.recorded)
	}
}

func TestServiceResumeSaysWhenTheRunningReviewsCannotBeListed(t *testing.T) {
	service, _ := serviceFor(&fakeTools{runningErr: errors.New("down")}, nil, &stubReviewer{area: AreaGoals})
	err := service.Resume(context.Background())
	if err == nil || !strings.HasPrefix(err.Error(), "The running reviews could not be listed") {
		t.Errorf("err = %v", err)
	}
}

func TestServiceLaunchesUnderItsLifetimeContext(t *testing.T) {
	tools := &fakeTools{started: pageReading(AreaGoals)}
	service, runner := serviceFor(tools, func(context.Context, string) error { return nil }, &stubReviewer{area: AreaGoals, err: context.Canceled})
	lifetime, cancel := context.WithCancel(context.Background())
	cancel()
	service.Lifetime = lifetime
	if _, err := service.Start(context.Background(), "ag", "d", "p", ""); err != nil {
		t.Fatal(err)
	}
	runner.Wait()
	if len(tools.recorded) != 0 {
		t.Errorf("a stopped server must leave the area reading, recorded %v", tools.recorded)
	}
}
