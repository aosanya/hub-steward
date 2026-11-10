package http

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	mwanachamaactor "wakalaserver/modules/actor"
	actormodels "wakalaserver/modules/actor/models"
	mwanachamaagency "wakalaserver/modules/agency"
	agencymodels "wakalaserver/modules/agency/models"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

type staffDirectory struct {
	mwanachamaactor.UserManager
	seats    []mwanachamaactor.ActorRoleAssignment
	kinds    map[string]actormodels.RoleKind
	seatsErr error
}

func (d staffDirectory) ListRoleAssignmentsForActor(context.Context, string, bool) ([]mwanachamaactor.ActorRoleAssignment, error) {
	return d.seats, d.seatsErr
}

func (d staffDirectory) GetRoleKind(_ context.Context, id string) (actormodels.RoleKind, error) {
	kind, ok := d.kinds[id]
	if !ok {
		return actormodels.RoleKind{}, errors.New("no such kind")
	}
	return kind, nil
}

type staffRegistry struct {
	agencies.Registry
	role      string
	roleErr   error
	directory mwanachamaactor.UserManager
	dirErr    error
}

func (r staffRegistry) RoleOf(context.Context, string, string) (string, error) {
	return r.role, r.roleErr
}

func (r staffRegistry) ActorManager(context.Context, string) (mwanachamaactor.UserManager, error) {
	return r.directory, r.dirErr
}

func seatOf(kind string) mwanachamaactor.ActorRoleAssignment {
	return mwanachamaactor.ActorRoleAssignment{KindID: kind}
}

func TestOwnersAndAgentsAreStaffWithoutASeat(t *testing.T) {
	for _, role := range []string{agencies.RoleOwner, agencies.RoleAgent} {
		ok, err := isStaff(context.Background(), staffRegistry{role: role}, "i", " someone ")
		if err != nil || !ok {
			t.Fatalf("%s must be staff, got %v %v", role, ok, err)
		}
	}
}

func TestStaffFollowsTheSeatsAResidentHolds(t *testing.T) {
	dir := staffDirectory{
		seats: []mwanachamaactor.ActorRoleAssignment{seatOf("gone"), seatOf("retired"), seatOf("plain"), seatOf("clerk")},
		kinds: map[string]actormodels.RoleKind{
			"retired": {Staff: true, RetiredAt: "2026-01-01"},
			"plain":   {},
			"clerk":   {Staff: true},
		},
	}
	reg := staffRegistry{role: agencies.RoleResident, directory: dir}
	ok, err := isStaff(context.Background(), reg, "i", "p")
	if err != nil || !ok {
		t.Fatalf("a live staff seat makes a resident staff, got %v %v", ok, err)
	}
	dir.seats = dir.seats[:3]
	ok, err = isStaff(context.Background(), staffRegistry{role: agencies.RoleResident, directory: dir}, "i", "p")
	if err != nil || ok {
		t.Fatalf("an unknown, retired or plain seat is not staff, got %v %v", ok, err)
	}
}

func TestStaffStopsAtTheFirstReadFailure(t *testing.T) {
	boom := errors.New("down")
	if _, err := isStaff(context.Background(), staffRegistry{roleErr: boom}, "i", "p"); !errors.Is(err, boom) {
		t.Fatalf("a failed role read must be returned, got %v", err)
	}
	reg := staffRegistry{role: agencies.RoleResident, directory: staffDirectory{seatsErr: boom}}
	if _, err := isStaff(context.Background(), reg, "i", "p"); !errors.Is(err, boom) {
		t.Fatalf("a failed seat read must be returned, got %v", err)
	}
}

func TestStaffIsFalseWithoutAPersonOrADirectory(t *testing.T) {
	ok, err := isStaff(context.Background(), staffRegistry{role: agencies.RoleResident}, "i", "   ")
	if err != nil || ok {
		t.Fatalf("a blank person is not staff, got %v %v", ok, err)
	}
	reg := staffRegistry{role: agencies.RoleResident, dirErr: errors.New("no directory")}
	ok, err = isStaff(context.Background(), reg, "i", "p")
	if err != nil || ok {
		t.Fatalf("an agency with no directory has no staff seats, got %v %v", ok, err)
	}
}

func TestVoterKindNamesTheCallersRole(t *testing.T) {
	cases := map[string]string{
		agencies.RoleResident: "member",
		agencies.RoleOwner:    "owner",
		agencies.RoleAgent:    "agent",
		"":                    "unknown",
		"visitor":             "unknown",
	}
	for role, want := range cases {
		if got := voterKindFor(role); got != want {
			t.Errorf("voterKindFor(%q) = %q, want %q", role, got, want)
		}
	}
}

func pinnedBody(t *testing.T, body string, role string) (map[string]any, bool, *http.Request) {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/vote", strings.NewReader(body))
	rec := httptest.NewRecorder()
	ok := pinVoterKindOnRequest(rec, req, role)
	if !ok {
		return nil, false, req
	}
	raw, _ := io.ReadAll(req.Body)
	fields := map[string]any{}
	_ = json.Unmarshal(raw, &fields)
	return fields, true, req
}

func TestAVoteBodyCarriesTheCallersKindNotTheOneItClaims(t *testing.T) {
	fields, ok, req := pinnedBody(t, `{"case_id":"c1","member_kind":"owner"}`, agencies.RoleResident)
	if !ok || fields["member_kind"] != "member" || fields["case_id"] != "c1" {
		t.Fatalf("the claimed kind must be overwritten and the rest kept, got %v", fields)
	}
	if req.ContentLength <= 0 {
		t.Fatalf("the rewritten body needs its own length, got %d", req.ContentLength)
	}
}

func TestAnEmptyVoteBodyStillGetsTheKind(t *testing.T) {
	fields, ok, _ := pinnedBody(t, "  ", agencies.RoleOwner)
	if !ok || fields["member_kind"] != "owner" {
		t.Fatalf("an empty body must gain the kind, got %v", fields)
	}
}

func TestAVoteBodyThatIsNotAnObjectPassesThroughUntouched(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/vote", strings.NewReader(`[1,2]`))
	if !pinVoterKindOnRequest(httptest.NewRecorder(), req, agencies.RoleResident) {
		t.Fatal("a body that is not an object is left for the route to refuse")
	}
	raw, _ := io.ReadAll(req.Body)
	if string(raw) != `[1,2]` {
		t.Fatalf("the body must be handed on as it came, got %s", raw)
	}
}

type brokenBody struct{}

func (brokenBody) Read([]byte) (int, error) { return 0, errors.New("reset") }

func TestAVoteBodyThatCannotBeReadIsRefused(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/vote", brokenBody{})
	rec := httptest.NewRecorder()
	if pinVoterKindOnRequest(rec, req, agencies.RoleResident) || rec.Code != http.StatusBadRequest {
		t.Fatalf("an unreadable body is a 400, got %d", rec.Code)
	}
}

func TestCallerAgencyRoleIsBlankWhenTheReadFails(t *testing.T) {
	ctx := accounts.WithID(context.Background(), "p")
	if got := callerAgencyRole(ctx, staffRegistry{role: agencies.RoleAgent}, "i"); got != agencies.RoleAgent {
		t.Fatalf("got %q", got)
	}
	if got := callerAgencyRole(ctx, staffRegistry{roleErr: errors.New("down")}, "i"); got != "" {
		t.Fatalf("a failed read gives no role, got %q", got)
	}
}

type reviewRecorder struct {
	mwanachamaagency.AgencyManager
	startedBy, commentedBy string
}

func (r *reviewRecorder) StartReview(_ context.Context, _, by, _ string) (agencymodels.ReviewView, error) {
	r.startedBy = by
	return agencymodels.ReviewView{}, nil
}

func (r *reviewRecorder) CommentFinding(_ context.Context, _, _, by string) (agencymodels.ReviewComment, error) {
	r.commentedBy = by
	return agencymodels.ReviewComment{}, nil
}

func TestReviewsAreAlwaysByTheSignedInPerson(t *testing.T) {
	rec := &reviewRecorder{}
	m := reviewsBySignedIn{rec}
	ctx := accounts.WithID(context.Background(), "real")
	if _, err := m.StartReview(ctx, "d1", "someone-else", "area"); err != nil || rec.startedBy != "real" {
		t.Fatalf("a review must start under the signed-in person, got %q %v", rec.startedBy, err)
	}
	if _, err := m.CommentFinding(ctx, "f1", "text", "someone-else"); err != nil || rec.commentedBy != "real" {
		t.Fatalf("a comment must be under the signed-in person, got %q %v", rec.commentedBy, err)
	}
}
