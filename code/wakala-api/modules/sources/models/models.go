package models

type Source struct {
	ID         string         `json:"id"`
	Title      string         `json:"title"`
	Kind       string         `json:"kind,omitempty"`
	Citation   string         `json:"citation,omitempty"`
	Locator    string         `json:"locator,omitempty"`
	ContentRef string         `json:"content_ref,omitempty"`
	IssuedOn   string         `json:"issued_on,omitempty"`
	Properties map[string]any `json:"properties,omitempty"`
	CreatedBy  string         `json:"created_by,omitempty"`
	CreatedAt  string         `json:"created_at"`
	UpdatedAt  string         `json:"updated_at"`
}

type SourceFilter struct {
	Kind string `query:"kind"`
}

type Annotation struct {
	ID           string         `json:"id"`
	SourceID     string         `json:"source_id"`
	TargetModule string         `json:"target_module"`
	TargetID     string         `json:"target_id"`
	Anchor       map[string]any `json:"anchor,omitempty"`
	Quote        string         `json:"quote,omitempty"`
	Note         string         `json:"note,omitempty"`
	CreatedBy    string         `json:"created_by,omitempty"`
	CreatedAt    string         `json:"created_at"`
}

type AnnotationFilter struct {
	SourceID     string `query:"source_id"`
	TargetModule string `query:"target_module"`
	TargetID     string `query:"target_id"`
}

type Verification struct {
	ID           string `json:"id"`
	SubjectRole  string `json:"subject_role"`
	SubjectID    string `json:"subject_id"`
	Status       string `json:"status"`
	VerifiedBy   string `json:"verified_by,omitempty"`
	VerifierName string `json:"verifier_name,omitempty"`
	VerifierRole string `json:"verifier_role,omitempty"`
	Note         string `json:"note,omitempty"`
	CreatedAt    string `json:"created_at"`
}

type VerificationFilter struct {
	SubjectRole string `query:"subject_role"`
	SubjectID   string `query:"subject_id"`
}

type Chunk struct {
	ID             string    `json:"id"`
	SourceID       string    `json:"source_id"`
	Position       int       `json:"position"`
	Text           string    `json:"text"`
	Heading        string    `json:"heading,omitempty"`
	StartOffset    int       `json:"start_offset"`
	EndOffset      int       `json:"end_offset"`
	Embedding      []float64 `json:"embedding,omitempty"`
	EmbeddingModel string    `json:"embedding_model,omitempty"`
	CreatedAt      string    `json:"created_at"`
}

type Document struct {
	SourceID string `json:"source_id"`
	Text     string `json:"text"`
	Format   string `json:"format,omitempty"`
}

type ChunkQuery struct {
	Embedding      []float64 `json:"embedding"`
	EmbeddingModel string    `json:"embedding_model"`
	SourceID       string    `json:"source_id,omitempty"`
	Limit          int       `json:"limit,omitempty"`
}

type ChunkMatch struct {
	Chunk    Chunk         `json:"chunk"`
	Source   Source        `json:"source"`
	Standing *Verification `json:"standing,omitempty"`
	Score    float64       `json:"score"`
}

type Profile struct {
	Name string
	Role string
}
