package mwanachamacouncil

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"sync"

	"wakalaserver/modules/shared/spec"
)

//go:embed council.blueprint.json
var blueprintJSON []byte

//go:embed council.wakala.json
var domainJSON []byte

//go:embed council.operations.json
var operationsJSON []byte

var loadBlueprint = sync.OnceValues(func() (*spec.Blueprint, error) {
	return spec.ParseBlueprint(blueprintJSON)
})

func Blueprint() (*spec.Blueprint, error) { return loadBlueprint() }

func Operations() []byte { return operationsJSON }

func LoadSpec(path string) (*spec.Spec, error) {
	b, err := Blueprint()
	if err != nil {
		return nil, err
	}
	return b.Load(path)
}

func ParseSpec(raw []byte) (*spec.Spec, error) {
	b, err := Blueprint()
	if err != nil {
		return nil, err
	}
	return b.Parse(raw)
}

func SpecFor(instance string) (*spec.Spec, error) {
	return SpecForMount(instance, "")
}

func SpecForMount(instance, mount string) (*spec.Spec, error) {
	var doc map[string]any
	if err := json.Unmarshal(domainJSON, &doc); err != nil {
		return nil, fmt.Errorf("council spec: %w", err)
	}
	doc["instance"] = instance
	if mount != "" {
		doc["mount"] = mount
	}
	raw, err := json.Marshal(doc)
	if err != nil {
		return nil, fmt.Errorf("council spec: %w", err)
	}
	return ParseSpec(raw)
}
