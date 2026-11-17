package http

import (
	"context"
	"encoding/json"
	nethttp "net/http"
	"strings"
	"testing"
	"time"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	"wakalaserver/internal/accounts"
)

const staleNamePhrase = "name changed since you read it"

func (w designAgentWalk) readUpdatedAt(t *testing.T) string {
	t.Helper()
	rec := w.call(t, "GET", w.base, nil, w.owner)
	if rec.Code != nethttp.StatusOK {
		t.Fatalf("owner reads the agency: %d %s", rec.Code, rec.Body.String())
	}
	updatedAt, _ := decodeObject(t, rec)["updated_at"].(string)
	if updatedAt == "" {
		t.Fatalf("agency has no updated_at: %s", rec.Body.String())
	}
	return updatedAt
}

func (w designAgentWalk) storedName(t *testing.T) string {
	t.Helper()
	rec := w.call(t, "GET", w.base, nil, w.owner)
	name, _ := decodeObject(t, rec)["name"].(string)
	return name
}

func hourOld(t *testing.T, updatedAt string) string {
	t.Helper()
	at, err := time.Parse(time.RFC3339Nano, updatedAt)
	if err != nil {
		t.Fatalf("parse updated_at %q: %v", updatedAt, err)
	}
	return at.Add(-time.Hour).Format(time.RFC3339Nano)
}

func TestInstanceRenameVersion_TheCurrentVersionSaves(t *testing.T) {
	w := newDesignAgentWalk(t)
	version := w.readUpdatedAt(t)

	out := w.mcpCall(t, "test-owner", "instance_rename", map[string]any{"instance_id": w.instance, "name": "Renamed once", "version": version})
	if out.IsError {
		t.Fatalf("rename with the current version: %s", toolErrorText(out))
	}
	if got := w.storedName(t); got != "Renamed once" {
		t.Fatalf("stored name = %q, want Renamed once", got)
	}
}

func TestInstanceRenameVersion_AnOldVersionIsRefusedNamingTheName(t *testing.T) {
	w := newDesignAgentWalk(t)
	before := w.storedName(t)
	old := hourOld(t, w.readUpdatedAt(t))

	out := w.mcpCall(t, "test-owner", "instance_rename", map[string]any{"instance_id": w.instance, "name": "Lost update", "version": old})
	if !out.IsError {
		t.Fatalf("rename with an old version succeeded, want a tool error")
	}
	if text := toolErrorText(out); !strings.Contains(text, staleNamePhrase) {
		t.Fatalf("tool error = %q, want it to carry %q", text, staleNamePhrase)
	}
	if got := w.storedName(t); got != before {
		t.Fatalf("stored name = %q after a refused save, want %q", got, before)
	}
}

func TestInstanceRenameVersion_NoVersionSavesAsBefore(t *testing.T) {
	w := newDesignAgentWalk(t)

	out := w.mcpCall(t, "test-owner", "instance_rename", map[string]any{"instance_id": w.instance, "name": "Renamed blind"})
	if out.IsError {
		t.Fatalf("rename without a version: %s", toolErrorText(out))
	}
	if got := w.storedName(t); got != "Renamed blind" {
		t.Fatalf("stored name = %q, want Renamed blind", got)
	}
}

func TestInstanceRenameVersion_TheRouteAnswers409ForAnOldVersion(t *testing.T) {
	w := newDesignAgentWalk(t)
	before := w.storedName(t)
	version := w.readUpdatedAt(t)

	stale := w.call(t, "PUT", w.base+"/name", map[string]any{"name": "Lost update", "version": hourOld(t, version)}, w.owner)
	if stale.Code != nethttp.StatusConflict || !strings.Contains(stale.Body.String(), staleNamePhrase) {
		t.Fatalf("rename with an old version: %d %s, want 409 carrying %q", stale.Code, stale.Body.String(), staleNamePhrase)
	}
	if got := w.storedName(t); got != before {
		t.Fatalf("stored name = %q after a refused save, want %q", got, before)
	}

	fresh := w.call(t, "PUT", w.base+"/name", map[string]any{"name": "Saved from the form", "version": version}, w.owner)
	if fresh.Code != nethttp.StatusOK {
		t.Fatalf("rename with the current version: %d %s, want 200", fresh.Code, fresh.Body.String())
	}
}

func TestInstanceRenameVersion_TheSchemaAcceptsVersion(t *testing.T) {
	w := newDesignAgentWalk(t)
	ctx := accounts.WithID(context.Background(), "test-owner")
	serverSide, clientSide := mcp.NewInMemoryTransports()
	session, err := newMCPServer(w.deps).Connect(ctx, serverSide, nil)
	if err != nil {
		t.Fatalf("connect server: %v", err)
	}
	t.Cleanup(func() { session.Close() })
	client, err := mcp.NewClient(&mcp.Implementation{Name: "test", Version: "1"}, nil).Connect(ctx, clientSide, nil)
	if err != nil {
		t.Fatalf("connect client: %v", err)
	}
	t.Cleanup(func() { client.Close() })
	listed, err := client.ListTools(ctx, nil)
	if err != nil {
		t.Fatalf("list tools: %v", err)
	}
	for _, tool := range listed.Tools {
		if tool.Name != "instance_rename" {
			continue
		}
		raw, err := json.Marshal(tool.InputSchema)
		if err != nil {
			t.Fatalf("marshal schema: %v", err)
		}
		var schema struct {
			Properties           map[string]json.RawMessage `json:"properties"`
			Required             []string                   `json:"required"`
			AdditionalProperties json.RawMessage            `json:"additionalProperties"`
		}
		if err := json.Unmarshal(raw, &schema); err != nil {
			t.Fatalf("schema: %v", err)
		}
		if _, ok := schema.Properties["version"]; !ok {
			t.Fatalf("instance_rename has no version property: %s", raw)
		}
		for _, name := range schema.Required {
			if name == "version" {
				t.Fatalf("version is required: %s", raw)
			}
		}
		if string(schema.AdditionalProperties) != "false" {
			t.Fatalf("additionalProperties = %s, want false", schema.AdditionalProperties)
		}
		return
	}
	t.Fatalf("instance_rename is not listed")
}
