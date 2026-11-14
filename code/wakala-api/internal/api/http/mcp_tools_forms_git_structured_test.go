package http

import (
	"encoding/json"
	"testing"
)

type structuredSample struct {
	Name string `json:"name"`
}

func TestAListOfRepositoriesReachesTheAppAsItems(t *testing.T) {
	got := gitStructuredContent([]structuredSample{{Name: "hub-steward-flutter-app"}})

	encoded, err := json.Marshal(got)
	if err != nil {
		t.Fatalf("the list does not encode: %v", err)
	}
	if string(encoded) != `{"items":[{"name":"hub-steward-flutter-app"}]}` {
		t.Fatalf("a list reaches the app as %s", encoded)
	}
}

func TestAnEmptyListOfRepositoriesReachesTheAppAsAnEmptyItemsList(t *testing.T) {
	var none []structuredSample

	encoded, _ := json.Marshal(gitStructuredContent(none))

	if string(encoded) != `{"items":[]}` {
		t.Fatalf("an empty list reaches the app as %s", encoded)
	}
}

func TestOneRepositoryReachesTheAppAsItsOwnObject(t *testing.T) {
	encoded, _ := json.Marshal(gitStructuredContent(&structuredSample{Name: "x"}))

	if string(encoded) != `{"name":"x"}` {
		t.Fatalf("one repository reaches the app as %s", encoded)
	}
}

func TestADeleteThatReturnsNothingCarriesNoStructuredContent(t *testing.T) {
	if got := gitStructuredContent(nil); got != nil {
		t.Fatalf("nothing returned yet structured content is %v", got)
	}
}
