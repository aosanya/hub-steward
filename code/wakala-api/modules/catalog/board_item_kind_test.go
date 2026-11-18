package mwanachamacatalog_test

import (
	"context"
	"errors"
	"testing"

	catalog "wakalaserver/modules/catalog"
)

func TestABoardItemCarriesAComplaintOrAnIdeaAndTheListShowsIt(t *testing.T) {
	cm := entryManager(t)
	ctx := context.Background()
	complaint, err := cm.PutOnBoard(ctx, catalog.BoardItem{Title: "Potholes on Mill Road", Kind: "complaint"})
	if err != nil || complaint.Kind != "complaint" {
		t.Fatalf("%+v %v", complaint, err)
	}
	idea, err := cm.PutOnBoard(ctx, catalog.BoardItem{Title: "A playground in Kertvaros", Kind: "idea"})
	if err != nil || idea.Kind != "idea" {
		t.Fatalf("%+v %v", idea, err)
	}
	plain, err := cm.PutOnBoard(ctx, catalog.BoardItem{Title: "Bus stop"})
	if err != nil || plain.Kind != "" {
		t.Fatalf("%+v %v", plain, err)
	}
	listed, err := cm.ListBoardItems(ctx)
	if err != nil {
		t.Fatal(err)
	}
	kinds := map[string]string{}
	for _, one := range listed {
		kinds[one.Title] = one.Kind
	}
	if kinds["Potholes on Mill Road"] != "complaint" || kinds["A playground in Kertvaros"] != "idea" || kinds["Bus stop"] != "" {
		t.Fatalf("the list lost the kind: %v", kinds)
	}
	if _, err := cm.PutOnBoard(ctx, catalog.BoardItem{Title: "Odd", Kind: "rumour"}); !errors.Is(err, catalog.ErrInvalidBoardItem) {
		t.Fatalf("a kind other than complaint or idea was accepted: %v", err)
	}
}
