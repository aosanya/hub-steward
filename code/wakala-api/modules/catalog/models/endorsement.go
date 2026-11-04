package models

type Endorsement struct {
	SubjectID string `json:"subject_id"`
	HolderID  string `json:"holder_id"`
	CreatedAt string `json:"created_at"`
}
