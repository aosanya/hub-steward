package routes

import (
	"fmt"

	"wakalaserver/modules/shared/dispatch"
	"wakalaserver/modules/shared/spec"

	ratings "wakalaserver/modules/ratings"
)

type Tool = dispatch.Tool

var carriers = map[string]string{
	ratings.RoleRating:     "Rating",
	ratings.RoleSimilarity: "Similarity",
	ratings.RoleSetting:    "Setting",
}

var filterFields = map[string]dispatch.FieldDoc{
	"RatingFilter.rater": {
		Description: "Keep only this rater's ratings.",
	},
	"RatingFilter.item": {
		Description: "Keep only ratings of this item.",
	},
	"RatingFilter.limit": {
		Description: "Cap the rows returned. Zero means the module's cap of 500.",
	},
	"SimilarityFilter.key": {
		Description: "The rater or item whose neighbours to list.",
	},
	"SimilarityFilter.kind": {
		Description: "Which neighbourhood to read: raters alike in taste, or items alike in who rated them.",
		Values:      []string{string(ratings.KindRater), string(ratings.KindItem)},
	},
	"SimilarityFilter.limit": {
		Description: "Cap the rows returned. Zero means the module's cap of 500.",
	},
}

func Fields() (map[string]dispatch.FieldDoc, error) {
	b, err := ratings.Blueprint()
	if err != nil {
		return nil, err
	}
	out := map[string]dispatch.FieldDoc{}
	for _, role := range b.Roles() {
		carrier, named := carriers[role]
		if !named {
			return nil, fmt.Errorf("ratings tools: role %q has no type to describe", role)
		}
		o, ok := b.Object(role)
		if !ok {
			return nil, fmt.Errorf("ratings tools: the blueprint declares no %q", role)
		}
		for _, f := range o.Fields {
			out[carrier+"."+f.Name] = dispatch.FieldDoc{
				Description: f.Description,
				Required:    f.Required,
				ReadOnly:    f.Primary || f.Type == spec.TypeTimestamp,
				Values:      f.Values,
			}
		}
	}
	for key, doc := range filterFields {
		out[key] = doc
	}
	return out, nil
}

func BuildToolsFor(rm ratings.RatingsManager, m Mount) ([]Tool, error) {
	s, err := operations()
	if err != nil {
		return nil, err
	}
	fields, err := Fields()
	if err != nil {
		return nil, err
	}
	return dispatch.Tools(s, dispatch.Deps{
		Manager: rm, Errors: sentinels, Fields: fields, Authorize: m.Authorize, Caller: m.Caller,
	})
}

func ToolsFor(rm ratings.RatingsManager, m Mount) []Tool {
	out, err := BuildToolsFor(rm, m)
	if err != nil {
		panic(fmt.Sprintf("ratings tools: %v", err))
	}
	return out
}

func Tools(rm ratings.RatingsManager) []Tool { return ToolsFor(rm, Mount{}) }
