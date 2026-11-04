package models

type PickerKind string

const (
	PickerAgency PickerKind = "agency"
	PickerRole   PickerKind = "role"
	PickerGroup  PickerKind = "group"
)

type PickerActor struct {
	ID   string     `json:"id"`
	Name string     `json:"name"`
	Kind PickerKind `json:"kind"`
}

type Pickers struct {
	Actors      []PickerActor `json:"actors"`
	AnswerTypes []AnswerType  `json:"answer_types"`
}
