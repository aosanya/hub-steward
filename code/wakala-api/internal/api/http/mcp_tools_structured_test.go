package http

import (
	"encoding/json"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

type structuredSample struct {
	Name string `json:"name"`
}

func TestAListOfRepositoriesReachesTheAppAsItems(t *testing.T) {
	got := structuredContentOf([]structuredSample{{Name: "hub-steward-flutter-app"}})

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

	encoded, _ := json.Marshal(structuredContentOf(none))

	if string(encoded) != `{"items":[]}` {
		t.Fatalf("an empty list reaches the app as %s", encoded)
	}
}

func TestOneRepositoryReachesTheAppAsItsOwnObject(t *testing.T) {
	encoded, _ := json.Marshal(structuredContentOf(&structuredSample{Name: "x"}))

	if string(encoded) != `{"name":"x"}` {
		t.Fatalf("one repository reaches the app as %s", encoded)
	}
}

func TestADeleteThatReturnsNothingCarriesNoStructuredContent(t *testing.T) {
	if got := structuredContentOf(nil); got != nil {
		t.Fatalf("nothing returned yet structured content is %v", got)
	}
}

func TestAListToolAnswerCarriesItemsInStructuredContentBesideTheText(t *testing.T) {
	rows := []structuredSample{{Name: "a"}, {Name: "b"}}

	result := toolValue(rows)

	encoded, err := json.Marshal(result.StructuredContent)
	if err != nil {
		t.Fatalf("the structured part does not encode: %v", err)
	}
	if string(encoded) != `{"items":[{"name":"a"},{"name":"b"}]}` {
		t.Fatalf("a list tool answers with structured content %s", encoded)
	}
	if result.IsError {
		t.Fatal("a list answer is marked as an error")
	}
	text, ok := result.Content[0].(*mcp.TextContent)
	if !ok || text.Text != rendering(rows) {
		t.Fatalf("the text part is %v, want the rendering of the rows", result.Content[0])
	}
}

func TestAListToolWithNoRowsAnswersWithAnEmptyItemsList(t *testing.T) {
	var none []structuredSample

	encoded, _ := json.Marshal(toolValue(none).StructuredContent)

	if string(encoded) != `{"items":[]}` {
		t.Fatalf("an empty list tool answers with structured content %s", encoded)
	}
}
