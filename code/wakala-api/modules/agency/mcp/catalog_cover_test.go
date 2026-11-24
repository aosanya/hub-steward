package mcp

import (
	"context"
	"fmt"
	"strings"
	"testing"

	sdk "github.com/modelcontextprotocol/go-sdk/mcp"
)

func listTypes(t *testing.T, name string) ([]typeInfo, string) {
	t.Helper()
	result, out, err := mcpListTypes()(context.Background(), nil, mcpListTypesParams{Name: name})
	if err != nil {
		t.Fatalf("listing types failed: %v", err)
	}
	text := ""
	if result != nil && len(result.Content) > 0 {
		if tc, ok := result.Content[0].(*sdk.TextContent); ok {
			text = tc.Text
		}
	}
	return out.Items, text
}

func TestListTypesWithoutNameReturnsTheWholeGlossary(t *testing.T) {
	items, summaryText := listTypes(t, "")
	if len(items) != len(domainTypeCatalog) {
		t.Fatalf("got %d types, want %d", len(items), len(domainTypeCatalog))
	}
	if want := fmt.Sprintf("Found %d domain type(s)", len(domainTypeCatalog)); !strings.Contains(summaryText, want) {
		t.Fatalf("summary does not report the count: %q", summaryText)
	}
}

func TestListTypesFiltersByCaseInsensitiveSubstring(t *testing.T) {
	items, _ := listTypes(t, "OBJECTIVE")
	if len(items) != 1 || items[0].Name != "Objective" {
		t.Fatalf("got %+v, want only Objective", items)
	}
	items, _ = listTypes(t, "work")
	names := map[string]bool{}
	for _, i := range items {
		names[i.Name] = true
	}
	if len(items) != 2 || !names["Workflow"] || !names["WorkItem"] {
		t.Fatalf("got %+v, want Workflow and WorkItem", items)
	}
}

func TestListTypesMatchesParenthesisedNameFragment(t *testing.T) {
	items, _ := listTypes(t, "raci")
	if len(items) != 1 || items[0].Name != "RoleAssignment (RACI)" {
		t.Fatalf("got %+v, want RoleAssignment (RACI)", items)
	}
}

func TestListTypesWithUnknownNameIsEmptyNotAnError(t *testing.T) {
	items, summaryText := listTypes(t, "no-such-type")
	if len(items) != 0 {
		t.Fatalf("got %+v, want none", items)
	}
	if !strings.Contains(summaryText, "Found 0 domain type(s)") {
		t.Fatalf("summary does not report zero: %q", summaryText)
	}
}

func TestEveryGlossaryEntryIsFullyDescribed(t *testing.T) {
	seen := map[string]bool{}
	for _, e := range domainTypeCatalog {
		if e.Name == "" || e.WhatItIs == "" || e.HowToAdd == "" {
			t.Errorf("entry %q has an empty field", e.Name)
		}
		if seen[e.Name] {
			t.Errorf("entry %q is listed twice", e.Name)
		}
		seen[e.Name] = true
	}
}
