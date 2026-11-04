package routes

import (
	"fmt"

	"wakalaserver/modules/shared/dispatch"

	catalog "wakalaserver/modules/catalog"
	"wakalaserver/modules/shared/spec"
)

type Tool = dispatch.Tool

var carriers = map[string]string{
	"entry":              "Entry",
	"entry_private":      "EntryPrivate",
	"share_link":         "ShareLink",
	"suggestion":         "Suggestion",
	"suggestion_comment": "SuggestionComment",
	"suggestion_match":   "SuggestionMatch",
	"run":                "MiningRun",
	"setting":            "Setting",
	"page_view":          "PageView",
	"record":             "Record",
	"endorsement":        "Endorsement",
	"raised_item":        "RaisedItem",
	"board_item":         "BoardItem",
	"reply":              "Reply",
	"removal":            "Removal",
	"raised_item_file":   "RaisedItemFile",
	"scope_figure":       "ScopeFigure",
	"slot":               "Slot",
	"booking":            "Booking",
}

var storeOwned = map[string]bool{
	"Entry.visibility":    true,
	"Entry.deleted":       true,
	"Suggestion.status":   true,
	"Suggestion.attempts": true,
}

var filterFields = map[string]dispatch.FieldDoc{
	"ListFilter.visibility": {
		Description: "Keep only entries in this state.",
		Values:      []string{"pending", "public", "private"},
	},
	"ListFilter.docs": {
		Description: "Keep only entries whose document holds the given value at the given dotted path, such as {\"path\": \"_template.sector\", \"value\": \"health\"}.",
	},
	"ListFilter.search": {
		Description: "Keep only entries whose name or summary contains this, ignoring case.",
	},
	"ListFilter.limit": {
		Description: "Cap the cards returned. Zero means no cap.",
	},
}

func Fields() (map[string]dispatch.FieldDoc, error) {
	b, err := catalog.Blueprint()
	if err != nil {
		return nil, err
	}
	out := map[string]dispatch.FieldDoc{}
	for _, role := range b.Roles() {
		carrier, named := carriers[role]
		if !named {
			return nil, fmt.Errorf("catalog tools: role %q has no type to describe", role)
		}
		o, ok := b.Object(role)
		if !ok {
			return nil, fmt.Errorf("catalog tools: the blueprint declares no %q", role)
		}
		for _, f := range o.Fields {
			key := carrier + "." + f.Name
			out[key] = dispatch.FieldDoc{
				Description: f.Description,
				Required:    f.Required,
				ReadOnly:    f.Primary || f.Type == spec.TypeTimestamp || storeOwned[key],
				Values:      f.Values,
			}
		}
	}
	for key, doc := range filterFields {
		out[key] = doc
	}
	return out, nil
}

func BuildTools(cm catalog.CatalogManager) ([]Tool, error) { return BuildToolsWith(cm, nil) }

func BuildToolsWith(cm catalog.CatalogManager, authorize dispatch.Authorizer) ([]Tool, error) {
	return BuildToolsFor(cm, Mount{Authorize: authorize})
}

func BuildToolsFor(cm catalog.CatalogManager, m Mount) ([]Tool, error) {
	s, err := operations()
	if err != nil {
		return nil, err
	}
	fields, err := Fields()
	if err != nil {
		return nil, err
	}
	tools, err := dispatch.Tools(s, dispatch.Deps{
		Manager: cm, Errors: sentinels, Fields: fields, Authorize: m.Authorize, Caller: m.Caller,
	})
	if err != nil {
		return nil, err
	}
	return operatorOnly(tools), nil
}

func Tools(cm catalog.CatalogManager) []Tool { return ToolsWith(cm, nil) }

func ToolsWith(cm catalog.CatalogManager, authorize dispatch.Authorizer) []Tool {
	return ToolsFor(cm, Mount{Authorize: authorize})
}

func ToolsFor(cm catalog.CatalogManager, m Mount) []Tool {
	out, err := BuildToolsFor(cm, m)
	if err != nil {
		panic(fmt.Sprintf("catalog tools: %v", err))
	}
	return out
}

func operatorOnly(tools []Tool) []Tool {
	anonymous := map[string]bool{}
	for _, action := range AnonymousActions {
		anonymous[action] = true
	}
	out := make([]Tool, 0, len(tools))
	for _, t := range tools {
		if anonymous[t.Action] {
			continue
		}
		out = append(out, t)
	}
	return out
}
