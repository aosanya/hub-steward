package models

import (
	"bytes"
	"encoding/json"
	"errors"
	"strings"
)

type RoutingRule struct {
	Topic      string `json:"topic"`
	Department string `json:"department"`
}

type Routing struct {
	Default string        `json:"default"`
	Rules   []RoutingRule `json:"rules"`
}

var ErrRoutingMalformed = errors.New("routing setting is malformed")

func ParseRouting(value any) (Routing, error) {
	raw, err := json.Marshal(value)
	if err != nil {
		return Routing{}, ErrRoutingMalformed
	}
	if string(raw) == "null" {
		return Routing{}, nil
	}
	var routing Routing
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&routing); err != nil {
		return Routing{}, ErrRoutingMalformed
	}
	seen := map[string]bool{}
	for _, rule := range routing.Rules {
		topic := strings.ToLower(strings.TrimSpace(rule.Topic))
		if topic == "" || strings.TrimSpace(rule.Department) == "" || seen[topic] {
			return Routing{}, ErrRoutingMalformed
		}
		seen[topic] = true
	}
	return routing, nil
}

func (r Routing) DepartmentFor(topic string) string {
	want := strings.ToLower(strings.TrimSpace(topic))
	if want != "" {
		for _, rule := range r.Rules {
			if strings.ToLower(strings.TrimSpace(rule.Topic)) == want {
				return strings.TrimSpace(rule.Department)
			}
		}
	}
	return strings.TrimSpace(r.Default)
}
