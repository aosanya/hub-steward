package routes

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"wakalaserver/modules/shared/dispatch"
	sources "wakalaserver/modules/sources"
)

func TestSourcesToolsDoNotAskForTheirAuthor(t *testing.T) {
	tools := Tools(struct{ sources.SourceManager }{}, Mount{})
	byName := map[string]Tool{}
	for _, tool := range tools {
		byName[tool.Name] = tool
	}
	for name, field := range map[string]string{
		"sources_source_create":       "created_by",
		"sources_annotation_create":   "created_by",
		"sources_verification_create": "verified_by",
	} {
		tool, ok := byName[name]
		if !ok {
			t.Fatalf("%s is not a tool", name)
		}
		var schema struct {
			Properties map[string]json.RawMessage `json:"properties"`
		}
		if err := json.Unmarshal(tool.InputSchema, &schema); err != nil {
			t.Fatalf("%s schema: %v", name, err)
		}
		if _, asked := schema.Properties[field]; asked {
			t.Errorf("%s still takes %s from the request; the caller signs it", name, field)
		}
	}
}

type capturingManager struct {
	sources.SourceManager
	filed sources.Source
	vouch sources.Verification
}

func (m *capturingManager) CreateSource(_ context.Context, in sources.Source) (sources.Source, error) {
	m.filed = in
	return in, nil
}

func (m *capturingManager) Verify(_ context.Context, in sources.Verification) (sources.Verification, error) {
	m.vouch = in
	return in, nil
}

func callTool(m *capturingManager, name, arguments string) error {
	mount := Mount{Caller: func(context.Context) string { return "test-owner" }}
	for _, tool := range Tools(m, mount) {
		if tool.Name == name {
			_, err := tool.Handle(context.Background(), dispatch.Request{Arguments: json.RawMessage(arguments)})
			return err
		}
	}
	return fmt.Errorf("%s is not a tool", name)
}

func TestSourcesToolsRefuseAForgedAuthorAndSignWithTheCaller(t *testing.T) {
	forged := &capturingManager{}
	if err := callTool(forged, "sources_source_create", `{"title":"Housing act","created_by":"C-forged-clerk-1"}`); err == nil || forged.filed.CreatedBy != "" {
		t.Errorf("a forged created_by must be refused before the manager is called, got %v and %q", err, forged.filed.CreatedBy)
	}
	if err := callTool(forged, "sources_verification_create", `{"subject_role":"source","subject_id":"s-1","status":"verified","verified_by":"C-forged-clerk-1"}`); err == nil || forged.vouch.VerifiedBy != "" {
		t.Errorf("a forged verified_by must be refused before the manager is called, got %v and %q", err, forged.vouch.VerifiedBy)
	}
	honest := &capturingManager{}
	if err := callTool(honest, "sources_source_create", `{"title":"Housing act"}`); err != nil || honest.filed.CreatedBy != "test-owner" {
		t.Errorf("the source is filed by %q (%v); want test-owner", honest.filed.CreatedBy, err)
	}
	if err := callTool(honest, "sources_verification_create", `{"subject_role":"source","subject_id":"s-1","status":"verified"}`); err != nil || honest.vouch.VerifiedBy != "test-owner" {
		t.Errorf("the verification is by %q (%v); want test-owner", honest.vouch.VerifiedBy, err)
	}
}
