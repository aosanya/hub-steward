package models

import "time"

type Similarity struct {
	A       string    `json:"a"`
	Kind    Kind      `json:"kind"`
	B       string    `json:"b"`
	Metric  Metric    `json:"metric"`
	Score   float64   `json:"score"`
	Overlap int       `json:"overlap"`
	At      time.Time `json:"at"`
}

func (s Similarity) ScoreInRange() bool {
	return s.Score > 0 && s.Score <= 1
}

func (s Similarity) OverlapIsCount() bool {
	return s.Overlap >= 0
}
