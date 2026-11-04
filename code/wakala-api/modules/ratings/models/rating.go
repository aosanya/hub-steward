package models

import "time"

type Rating struct {
	Rater string    `json:"rater"`
	Item  string    `json:"item"`
	Value float64   `json:"value"`
	At    time.Time `json:"at"`
}

const (
	MinValue = 0.0
	MaxValue = 1.0
)

func (r Rating) ValueInRange() bool {
	return r.Value >= MinValue && r.Value <= MaxValue
}
