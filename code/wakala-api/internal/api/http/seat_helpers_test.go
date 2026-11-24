package http

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"
	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"

	mwanachamaactor "github.com/aosanya/mwanachama-backend-actor"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

const ownerAccountID = "test-owner"

type seatJar struct {
	mu         sync.Mutex
	cookies    map[string][]*http.Cookie
	home       map[string]string
	seatGroups map[string]string
	members    map[string][]string
	given      map[string][]string
}

var seatJars sync.Map

func (w stepRunWalk) jar() *seatJar {
	fresh := &seatJar{
		cookies:    map[string][]*http.Cookie{},
		home:       map[string]string{},
		seatGroups: map[string]string{},
		members:    map[string][]string{},
		given:      map[string][]string{},
	}
	held, _ := seatJars.LoadOrStore(w.deps, fresh)
	return held.(*seatJar)
}

func homeKey(instance, subject string) string { return instance + "\x00" + subject }

func (w stepRunWalk) remember(as *http.Cookie, subject string) {
	jar := w.jar()
	jar.mu.Lock()
	defer jar.mu.Unlock()
	jar.cookies[subject] = append(jar.cookies[subject], as)
}

func (w stepRunWalk) seatsGroup(t *testing.T) string {
	t.Helper()
	jar := w.jar()
	jar.mu.Lock()
	defer jar.mu.Unlock()
	if id, ok := jar.seatGroups[w.instance]; ok {
		return id
	}
	um, err := w.deps.Registry.ActorManager(context.Background(), w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	group, err := um.CreateGroup(context.Background(), mwanachamaactor.Group{Name: "Seats"})
	if err != nil {
		t.Fatalf("CreateGroup: %v", err)
	}
	jar.seatGroups[w.instance] = group.ID
	w.reachingEveryRow(t, group.ID)
	return group.ID
}

func (w stepRunWalk) grantSeat(t *testing.T, subject, groupID, roleID string) {
	t.Helper()
	ctx := context.Background()
	mgr, err := w.deps.Registry.AgencyManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	um, err := w.deps.Registry.ActorManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	if _, err := um.EnsureActor(ctx, subject); err != nil {
		t.Fatalf("EnsureActor %s: %v", subject, err)
	}
	definition := roleID
	if published, err := mgr.GetRole(ctx, roleID); err == nil {
		definition = definitionRoleID(agencymodels.DocumentRole{ID: published.ID, Code: published.Code})
	}
	kind, err := um.RoleKindForDefinitionRole(ctx, definition)
	if errors.Is(err, mwanachamaactor.ErrRoleKindNotFound) {
		kind, err = um.CreateRoleKind(ctx, mwanachamaactor.RoleKind{Name: roleID, DefinitionRoleID: definition})
	}
	if err != nil {
		t.Fatalf("role kind of %s: %v", roleID, err)
	}
	if _, err := um.GrantRole(ctx, mwanachamaactor.ActorRoleAssignment{ActorID: subject, GroupID: groupID, KindID: kind.ID}); err != nil && !strings.Contains(err.Error(), "already") {
		t.Fatalf("GrantRole %s: %v", roleID, err)
	}
}

func (w stepRunWalk) makeHome(subject, groupID string) {
	jar := w.jar()
	jar.mu.Lock()
	defer jar.mu.Unlock()
	if _, has := jar.home[homeKey(w.instance, subject)]; !has {
		jar.home[homeKey(w.instance, subject)] = groupID
	}
}

func (w stepRunWalk) assumeHomeForAll(t *testing.T, subject string) {
	t.Helper()
	jar := w.jar()
	jar.mu.Lock()
	group := jar.home[homeKey(w.instance, subject)]
	cookies := append([]*http.Cookie{}, jar.cookies[subject]...)
	jar.mu.Unlock()
	if group == "" {
		return
	}
	for _, as := range cookies {
		w.assumeDirectly(t, as, subject, group)
	}
}

func (w stepRunWalk) seatAs(t *testing.T, subject, roleID string) {
	t.Helper()
	group := w.seatsGroup(t)
	w.grantSeat(t, subject, group, roleID)
	w.makeHome(subject, group)
	w.assumeHomeForAll(t, subject)
}

func (w stepRunWalk) homeOf(subject string) string {
	jar := w.jar()
	jar.mu.Lock()
	defer jar.mu.Unlock()
	return jar.home[homeKey(w.instance, subject)]
}

func (w stepRunWalk) joinedGroup(t *testing.T, actorID, groupID string, home bool) {
	t.Helper()
	w.reachingEveryRow(t, groupID)
	jar := w.jar()
	jar.mu.Lock()
	jar.members[groupID] = append(jar.members[groupID], actorID)
	given := append([]string{}, jar.given[groupID]...)
	jar.mu.Unlock()
	if home {
		w.makeHome(actorID, groupID)
	}
	for _, roleID := range given {
		w.grantSeat(t, actorID, groupID, roleID)
	}
}

func (w stepRunWalk) seatGroupMembers(t *testing.T, groupID, roleID string) {
	t.Helper()
	jar := w.jar()
	jar.mu.Lock()
	jar.given[groupID] = append(jar.given[groupID], roleID)
	members := append([]string{}, jar.members[groupID]...)
	jar.mu.Unlock()
	for _, actorID := range members {
		w.grantSeat(t, actorID, groupID, roleID)
		w.assumeHomeForAll(t, actorID)
	}
}

func (w stepRunWalk) asSubject(subject string) context.Context {
	ctx := accounts.WithID(context.Background(), subject)
	jar := w.jar()
	jar.mu.Lock()
	held := jar.cookies[subject]
	group := jar.home[homeKey(w.instance, subject)]
	jar.mu.Unlock()
	if len(held) > 0 {
		return agencies.WithLoginSession(ctx, cookieSessionKeyOf(held[0].Value))
	}
	key := "test-session:" + subject
	if kept, ok := w.deps.Registry.(agencies.AssumedGroups); ok && group != "" {
		_ = kept.AssumeGroup(ctx, key, w.instance, subject, group, time.Now().Add(time.Hour))
	}
	return agencies.WithLoginSession(ctx, key)
}
