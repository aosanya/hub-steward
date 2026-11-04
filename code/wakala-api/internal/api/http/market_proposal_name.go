package http

import "strings"

func marketNameIn(payload string) string {
	var p struct {
		Market string `json:"market"`
	}
	if decodePayload(payload, &p) != nil {
		return ""
	}
	return strings.TrimSpace(p.Market)
}
