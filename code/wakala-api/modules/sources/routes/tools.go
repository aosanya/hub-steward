package routes

import (
	"fmt"

	"wakalaserver/modules/shared/dispatch"
	"wakalaserver/modules/shared/spec"

	sources "wakalaserver/modules/sources"
)

type Tool = dispatch.Tool

var carriers = map[string]string{
	"source":       "Source",
	"annotation":   "Annotation",
	"verification": "Verification",
	"chunk":        "Chunk",
}

var storeOwned = map[string]bool{
	"Source.created_by":          true,
	"Annotation.created_by":      true,
	"Verification.verified_by":   true,
	"Verification.verifier_name": true,
	"Verification.verifier_role": true,
}

var inputFields = map[string]dispatch.FieldDoc{
	"SourceFilter.kind": {
		Description: "Keep only sources of this kind.",
	},
	"AnnotationFilter.source_id": {
		Description: "Keep only annotations resting on this source.",
	},
	"AnnotationFilter.target_module": {
		Description: "Keep only annotations on content held by this module.",
	},
	"AnnotationFilter.target_id": {
		Description: "Keep only annotations on this item of content.",
	},
	"VerificationFilter.subject_role": {
		Description: "Whether to read the history of a source or of an annotation.",
		Values:      []string{"source", "annotation"},
	},
	"VerificationFilter.subject_id": {
		Description: "The source or annotation whose history to read.",
	},
	"Document.source_id": {
		Description: "The source the document is the text of. The address decides, not the body.",
	},
	"Document.text": {
		Description: "The whole text of the document. Passages are split at blank lines and, in Markdown, at headings.",
		Required:    true,
	},
	"Document.format": {
		Description: "How to read the text. Markdown headings name the section each passage sits under; plain text has none. Defaults to text.",
		Values:      []string{"text", "markdown"},
	},
	"ChunkQuery.embedding": {
		Description: "The query as a vector, produced by the same model as the passages it is compared with.",
		Required:    true,
	},
	"ChunkQuery.embedding_model": {
		Description: "Which model produced the query vector. Only passages from the same model are compared.",
		Required:    true,
	},
	"ChunkQuery.source_id": {
		Description: "Search only this source's passages. Empty searches them all.",
	},
	"ChunkQuery.limit": {
		Description: "How many matches to return, closest first. Defaults to 5, at most 50.",
	},
}

func Fields() (map[string]dispatch.FieldDoc, error) {
	b, err := sources.Blueprint()
	if err != nil {
		return nil, err
	}
	out := map[string]dispatch.FieldDoc{}
	for _, role := range b.Roles() {
		carrier, named := carriers[role]
		if !named {
			return nil, fmt.Errorf("sources tools: role %q has no type to describe", role)
		}
		o, ok := b.Object(role)
		if !ok {
			return nil, fmt.Errorf("sources tools: the blueprint declares no %q", role)
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
	for key, doc := range inputFields {
		out[key] = doc
	}
	return out, nil
}

func BuildTools(sm sources.SourceManager, m Mount) ([]Tool, error) {
	s, err := Table.Spec()
	if err != nil {
		return nil, err
	}
	fields, err := Fields()
	if err != nil {
		return nil, err
	}
	return dispatch.Tools(s, dispatch.Deps{
		Manager: sm, Errors: Sentinels, Fields: fields, Authorize: m.Authorize, Caller: m.Caller,
	})
}

func Tools(sm sources.SourceManager, m Mount) []Tool {
	out, err := BuildTools(sm, m)
	if err != nil {
		panic(fmt.Sprintf("sources tools: %v", err))
	}
	return out
}
