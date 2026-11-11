package mcp

import (
	"encoding/json"
	"testing"

	mwanachamaagency "wakalaserver/modules/agency"
)

func TestReviewToolsDoNotAskForTheirAuthor(t *testing.T) {
	tools, err := toolsFor(mwanachamaagency.ManagerShape(), nil)
	if err != nil {
		t.Fatalf("toolsFor: %v", err)
	}
	for tool, field := range map[string]string{"agency_start_review": "started_by", "agency_comment_finding": "author"} {
		found, ok := byName(tools, tool)
		if !ok {
			t.Fatalf("%s is not a tool", tool)
		}
		var schema struct {
			Properties map[string]json.RawMessage `json:"properties"`
		}
		if err := json.Unmarshal(found.InputSchema, &schema); err != nil {
			t.Fatalf("%s schema: %v", tool, err)
		}
		if _, asked := schema.Properties[field]; asked {
			t.Errorf("%s still takes %s from the request; the caller signs it", tool, field)
		}
	}
}
