package engage_test

import (
	"context"
	"errors"
	"testing"

	engage "wakalaserver/modules/engage"
)

func agencyGroups(known ...string) engage.GroupExists {
	set := map[string]bool{}
	for _, g := range known {
		set[g] = true
	}
	return func(_ context.Context, id string) (bool, error) { return set[id], nil }
}

func TestAPostToAGroupTheAgencyDoesNotHaveIsRefused(t *testing.T) {
	pm := newTestManager(t)
	pm.UseGroupExists(agencyGroups("g-1"))
	in := anEvent()
	in.GroupIDs = []string{"g-1", "elsewhere"}
	if _, err := pm.CreatePost(context.Background(), in); !errors.Is(err, engage.ErrInvalidPost) {
		t.Fatalf("CreatePost = %v, want ErrInvalidPost", err)
	}
}

func TestAPostWithABlankGroupIDIsRefused(t *testing.T) {
	pm := newTestManager(t)
	in := anEvent()
	in.GroupIDs = []string{"g-1", "  "}
	if _, err := pm.CreatePost(context.Background(), in); !errors.Is(err, engage.ErrInvalidPost) {
		t.Fatalf("CreatePost = %v, want ErrInvalidPost", err)
	}
}

func TestAPostToTheAgencysOwnGroupsIsSent(t *testing.T) {
	pm := newTestManager(t)
	pm.UseGroupExists(agencyGroups("g-1", "g-2"))
	in := anEvent()
	in.GroupIDs = []string{"g-1", "g-2"}
	if _, err := pm.CreatePost(context.Background(), in); err != nil {
		t.Fatalf("CreatePost = %v", err)
	}
}

func TestAGroupLookupThatFailsIsNotReadAsAMissingGroup(t *testing.T) {
	pm := newTestManager(t)
	boom := errors.New("directory down")
	pm.UseGroupExists(func(context.Context, string) (bool, error) { return false, boom })
	if _, err := pm.CreatePost(context.Background(), anEvent()); !errors.Is(err, boom) {
		t.Fatalf("CreatePost = %v, want the lookup error", err)
	}
}
