package mwanachamacatalog

import (
	_ "embed"
	"encoding/json"
	"fmt"

	"wakalaserver/modules/shared/spec"
)

//go:embed agency.catalogue.json
var domainJSON []byte

func SpecFor(instance, mount string) (*spec.Spec, error) {
	var doc map[string]any
	if err := json.Unmarshal(domainJSON, &doc); err != nil {
		return nil, fmt.Errorf("catalog spec: %w", err)
	}
	doc["instance"] = instance
	if mount != "" {
		doc["mount"] = mount
	}
	raw, err := json.Marshal(doc)
	if err != nil {
		return nil, fmt.Errorf("catalog spec: %w", err)
	}
	return ParseSpec(raw)
}
