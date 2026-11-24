package agencies

import (
	"context"
	"errors"
	"fmt"
	"slices"

	mwanachamaactor "github.com/aosanya/mwanachama-backend-actor"
)

const (
	TestDataTagName   = "test-data"
	TestDataGroupName = "Test data"
)

type TestDataGroup struct {
	TagID        string `json:"tag_id"`
	TagName      string `json:"tag_name"`
	GroupID      string `json:"group_id"`
	GroupName    string `json:"group_name"`
	SeatsGranted int    `json:"seats_granted"`
}

type seatTerms struct {
	kindID string
	limit  *int
}

func EnsureTestDataGroup(ctx context.Context, reg Registry, tags Tags, instanceID string) (TestDataGroup, error) {
	tag, err := ensureTestDataTag(ctx, tags, instanceID)
	if err != nil {
		return TestDataGroup{}, fmt.Errorf("EnsureTestDataGroup: %w", err)
	}
	directory, err := reg.ActorManager(ctx, instanceID)
	if err != nil {
		return TestDataGroup{}, fmt.Errorf("EnsureTestDataGroup: %w", err)
	}
	group, err := ensureTestDataGroup(ctx, directory)
	if err != nil {
		return TestDataGroup{}, fmt.Errorf("EnsureTestDataGroup: %w", err)
	}
	if err := tags.GiveGroupTag(ctx, instanceID, group.ID, tag.ID); err != nil {
		return TestDataGroup{}, fmt.Errorf("EnsureTestDataGroup: %w", err)
	}
	granted, err := seatEveryoneIn(ctx, reg, directory, instanceID, group.ID)
	if err != nil {
		return TestDataGroup{}, fmt.Errorf("EnsureTestDataGroup: %w", err)
	}
	return TestDataGroup{TagID: tag.ID, TagName: tag.Name, GroupID: group.ID, GroupName: group.Name, SeatsGranted: granted}, nil
}

func ensureTestDataTag(ctx context.Context, tags Tags, instanceID string) (Tag, error) {
	listed, err := tags.ListTags(ctx, instanceID)
	if err != nil {
		return Tag{}, err
	}
	for _, tag := range listed {
		if tag.Name == TestDataTagName {
			return tag, nil
		}
	}
	return tags.CreateTag(ctx, instanceID, TestDataTagName)
}

func ensureTestDataGroup(ctx context.Context, directory mwanachamaactor.UserManager) (mwanachamaactor.Group, error) {
	groups, err := directory.ListGroups(ctx, "")
	if err != nil {
		return mwanachamaactor.Group{}, err
	}
	for _, group := range groups {
		if group.Name == TestDataGroupName && !group.Deleted {
			return group, nil
		}
	}
	return directory.CreateGroup(ctx, mwanachamaactor.Group{Name: TestDataGroupName})
}

func seatEveryoneIn(ctx context.Context, reg Registry, directory mwanachamaactor.UserManager, instanceID, groupID string) (int, error) {
	people, err := peopleOf(ctx, reg, directory, instanceID)
	if err != nil {
		return 0, err
	}
	granted := 0
	for _, person := range people {
		terms, err := ownSeatTerms(ctx, directory, person, groupID)
		if err != nil {
			return 0, err
		}
		if len(terms) == 0 {
			continue
		}
		if _, err := directory.EnsureActor(ctx, person.id); err != nil {
			return 0, err
		}
		for _, term := range terms {
			_, err := directory.GrantRole(ctx, mwanachamaactor.ActorRoleAssignment{ActorID: person.id, GroupID: groupID, KindID: term.kindID, ApprovalLimit: term.limit})
			if errors.Is(err, mwanachamaactor.ErrSeatAlreadyHeld) {
				continue
			}
			if err != nil {
				return 0, err
			}
			granted++
		}
	}
	return granted, nil
}

type testDataPerson struct {
	id    string
	owner bool
}

func peopleOf(ctx context.Context, reg Registry, directory mwanachamaactor.UserManager, instanceID string) ([]testDataPerson, error) {
	members, err := reg.Members(ctx, instanceID)
	if err != nil {
		return nil, err
	}
	actors, err := directory.ListActors(ctx)
	if err != nil {
		return nil, err
	}
	people := make([]testDataPerson, 0, len(members)+len(actors))
	seen := map[string]bool{}
	for _, member := range members {
		if !seen[member.UserID] {
			seen[member.UserID] = true
			people = append(people, testDataPerson{id: member.UserID, owner: member.Role == RoleOwner})
		}
	}
	for _, actor := range actors {
		if !actor.Deleted && !seen[actor.ID] {
			seen[actor.ID] = true
			people = append(people, testDataPerson{id: actor.ID})
		}
	}
	return people, nil
}

func ownSeatTerms(ctx context.Context, directory mwanachamaactor.UserManager, person testDataPerson, groupID string) ([]seatTerms, error) {
	held, err := LiveSeatsOf(ctx, directory, person.id)
	if err != nil {
		return nil, err
	}
	terms := []seatTerms{}
	for _, seat := range held {
		if seat.Seat.GroupID != groupID {
			terms = mergeTerms(terms, seatTerms{kindID: seat.Seat.KindID, limit: seat.Seat.ApprovalLimit})
		}
	}
	if len(terms) > 0 || !person.owner {
		return terms, nil
	}
	kind, err := administratorKind(ctx, directory)
	if err != nil {
		return nil, err
	}
	noApproval := 0
	return []seatTerms{{kindID: kind.ID, limit: &noApproval}}, nil
}

func mergeTerms(terms []seatTerms, next seatTerms) []seatTerms {
	at := slices.IndexFunc(terms, func(t seatTerms) bool { return t.kindID == next.kindID })
	if at < 0 {
		return append(terms, next)
	}
	kept := terms[at].limit
	switch {
	case kept == nil:
	case next.limit == nil || *next.limit > *kept:
		terms[at].limit = next.limit
	}
	return terms
}
