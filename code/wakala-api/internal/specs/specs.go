package specs

import (
	"embed"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
)

//go:embed *.json
var files embed.FS

func Declarations() []string {
	entries, err := files.ReadDir(".")
	if err != nil {
		return nil
	}
	out := make([]string, 0, len(entries))
	for _, e := range entries {
		out = append(out, strings.TrimSuffix(e.Name(), ".json"))
	}
	sort.Strings(out)
	return out
}

func ModuleOf(declaration string) (string, error) {
	raw, err := files.ReadFile(declaration + ".json")
	if err != nil {
		return "", fmt.Errorf("specs: no declaration named %q", declaration)
	}
	var doc struct {
		Module string `json:"module"`
	}
	if err := json.Unmarshal(raw, &doc); err != nil {
		return "", fmt.Errorf("specs: %s: %w", declaration, err)
	}
	if doc.Module == "" {
		return "", fmt.Errorf("specs: %s declares no module", declaration)
	}
	return doc.Module, nil
}

func Modules() []string {
	seen := map[string]bool{}
	var out []string
	for _, d := range Declarations() {
		m, err := ModuleOf(d)
		if err != nil || seen[m] {
			continue
		}
		seen[m] = true
		out = append(out, m)
	}
	sort.Strings(out)
	return out
}

func Raw(name string) ([]byte, error) {
	if raw, err := files.ReadFile(name + ".json"); err == nil {
		return raw, nil
	}
	var found []string
	for _, d := range Declarations() {
		m, err := ModuleOf(d)
		if err == nil && m == name {
			found = append(found, d)
		}
	}
	switch len(found) {
	case 0:
		return nil, fmt.Errorf("specs: no declaration for the module %q", name)
	case 1:
		return files.ReadFile(found[0] + ".json")
	default:
		return nil, fmt.Errorf("specs: the module %q has %d declarations (%s) — name the one you mean",
			name, len(found), strings.Join(found, ", "))
	}
}

func For(name, instance string) ([]byte, error) {
	raw, err := Raw(name)
	if err != nil {
		return nil, err
	}
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		return nil, fmt.Errorf("specs: %s: %w", name, err)
	}
	if instance != "" {
		doc["instance"] = instance
	}
	out, err := json.Marshal(doc)
	if err != nil {
		return nil, fmt.Errorf("specs: %s: %w", name, err)
	}
	return out, nil
}

func DeclaredInstance(name string) (string, error) {
	raw, err := Raw(name)
	if err != nil {
		return "", err
	}
	var doc struct {
		Instance string `json:"instance"`
	}
	if err := json.Unmarshal(raw, &doc); err != nil {
		return "", fmt.Errorf("specs: %s: %w", name, err)
	}
	return doc.Instance, nil
}
