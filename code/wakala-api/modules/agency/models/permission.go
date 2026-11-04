package models

import (
	_ "embed"
	"encoding/json"
	"fmt"
)

type Permission struct {
	Code    string   `json:"code"`
	Name    string   `json:"name"`
	Locked  bool     `json:"locked"`
	Module  string   `json:"module,omitempty"`
	Actions []string `json:"actions"`
}

//go:embed permissions_catalog.json
var permissionsCatalogJSON []byte

var permissionsCatalog = mustLoadPermissions(permissionsCatalogJSON)

func mustLoadPermissions(raw []byte) []Permission {
	var out []Permission
	if err := json.Unmarshal(raw, &out); err != nil {
		panic(fmt.Sprintf("models: permissions_catalog.json: %v", err))
	}
	seen := make(map[string]bool, len(out))
	for i, p := range out {
		if p.Code == "" || seen[p.Code] {
			panic(fmt.Sprintf("models: permissions_catalog.json: empty or duplicate code %q", p.Code))
		}
		seen[p.Code] = true
		if out[i].Actions == nil {
			out[i].Actions = []string{}
		}
	}
	return out
}

func PermissionCatalog() []Permission {
	return append([]Permission(nil), permissionsCatalog...)
}

func DistinctPermissions(codes []string) []string {
	if codes == nil {
		return nil
	}
	seen := make(map[string]bool, len(codes))
	out := make([]string, 0, len(codes))
	for _, c := range codes {
		if !seen[c] {
			seen[c] = true
			out = append(out, c)
		}
	}
	return out
}

func LookupPermission(code string) (Permission, bool) {
	for _, p := range permissionsCatalog {
		if p.Code == code {
			return p, true
		}
	}
	return Permission{}, false
}
