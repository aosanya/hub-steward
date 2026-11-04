package agencies

import (
	_ "embed"
	"encoding/json"
	"fmt"

	"wakalaserver/modules/shared/spec"

	mwanachamaassetmanager "wakalaserver/modules/assetmanager"
)

//go:embed assetmanager.wakala.json
var assetManagerDeclaration []byte

func assetManagerSpec(instance, mount string) (*spec.Spec, error) {
	var doc map[string]any
	if err := json.Unmarshal(assetManagerDeclaration, &doc); err != nil {
		return nil, fmt.Errorf("assetmanager spec: %w", err)
	}
	doc["instance"] = instance
	doc["mount"] = mount
	raw, err := json.Marshal(doc)
	if err != nil {
		return nil, fmt.Errorf("assetmanager spec: %w", err)
	}
	return mwanachamaassetmanager.ParseSpec(raw)
}
