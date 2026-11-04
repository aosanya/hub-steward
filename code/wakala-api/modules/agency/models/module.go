package models

import (
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"unicode"
	"unicode/utf8"
)

type Module struct {
	ID          string `json:"id"`
	Code        string `json:"code"`
	DraftID     string `json:"draft_id,omitempty"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Enabled     bool   `json:"enabled"`
	Locked      bool   `json:"locked"`
	Spec        string `json:"spec,omitempty"`
	Settings    string `json:"settings,omitempty"`
	Mounts      string `json:"mounts,omitempty"`
	Icon        string `json:"icon,omitempty"`
	CreatedAt   string `json:"created_at"`
	LastUpdated string `json:"last_updated"`
	Deleted     bool   `json:"deleted"`

	Explicit      bool `json:"explicit" spec:"-"`
	NeededBySteps bool `json:"needed_by_steps" spec:"-"`
}

type ModuleMount struct {
	Name string `json:"name"`
	Key  string `json:"key,omitempty"`
	Icon string `json:"icon,omitempty"`
}

const (
	MaxModuleMounts    = 16
	MaxMountNameLength = 60
)

var ModuleIcons = map[string]bool{
	"grid": true, "chat": true, "bell": true, "user": true, "file": true,
	"calendar": true, "clock": true, "globe": true, "wrench": true, "lock": true,
	"search": true, "wheat": true, "bike": true, "check": true, "alert": true, "send": true,
}

var ErrInvalidMounts = errors.New("module mounts are invalid")

type ModuleCatalogEntry struct {
	Code        string   `json:"code"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Enabled     bool     `json:"enabled"`
	Locked      bool     `json:"locked"`
	Icon        string   `json:"icon,omitempty"`
	Mount       string   `json:"mount,omitempty"`
	Mountable   bool     `json:"mountable,omitempty"`
	Requires    []string `json:"requires,omitempty"`
	StepKinds   []string `json:"step_kinds,omitempty"`
}

//go:embed modules_catalog.json
var modulesCatalogJSON []byte

var ModuleCatalog = mustParseModuleCatalog(modulesCatalogJSON)

func mustParseModuleCatalog(raw []byte) []ModuleCatalogEntry {
	var catalog []ModuleCatalogEntry
	if err := json.Unmarshal(raw, &catalog); err != nil {
		panic(fmt.Sprintf("models: invalid modules_catalog.json: %v", err))
	}
	seen := make(map[string]bool, len(catalog))
	for _, entry := range catalog {
		if entry.Code == "" {
			panic("models: modules_catalog.json contains an entry with an empty code")
		}
		if seen[entry.Code] {
			panic(fmt.Sprintf("models: modules_catalog.json contains a duplicate code %q", entry.Code))
		}
		seen[entry.Code] = true
		if entry.Icon != "" && !ModuleIcons[entry.Icon] {
			panic(fmt.Sprintf("models: modules_catalog.json: %q has the icon %q outside the shipped set", entry.Code, entry.Icon))
		}
	}
	for _, entry := range catalog {
		for _, kind := range entry.StepKinds {
			if !StepKind(kind).Valid() {
				panic(fmt.Sprintf("models: modules_catalog.json: %q lists the unknown step kind %q", entry.Code, kind))
			}
		}
		for _, required := range entry.Requires {
			if !seen[required] {
				panic(fmt.Sprintf("models: modules_catalog.json: %q requires unknown code %q", entry.Code, required))
			}
		}
	}
	return catalog
}

func ModuleRequires(code string) []string {
	for _, entry := range ModuleCatalog {
		if entry.Code == code {
			return entry.Requires
		}
	}
	return nil
}

func WithRequiredModules(enabled map[string]bool) map[string]bool {
	out := make(map[string]bool, len(enabled))
	pending := make([]string, 0, len(enabled))
	for code, on := range enabled {
		if on {
			pending = append(pending, code)
		}
	}
	for len(pending) > 0 {
		code := pending[len(pending)-1]
		pending = pending[:len(pending)-1]
		if out[code] {
			continue
		}
		out[code] = true
		pending = append(pending, ModuleRequires(code)...)
	}
	return out
}

func ModulesNeededBySteps(kinds map[StepKind]bool) map[string]bool {
	needed := make(map[string]bool)
	for _, entry := range ModuleCatalog {
		for _, kind := range entry.StepKinds {
			if kinds[StepKind(kind)] {
				needed[entry.Code] = true
			}
		}
	}
	return needed
}

func CatalogEntry(code string) (ModuleCatalogEntry, bool) {
	for _, entry := range ModuleCatalog {
		if entry.Code == code {
			return entry, true
		}
	}
	return ModuleCatalogEntry{}, false
}

func DefaultModuleMounts(entry ModuleCatalogEntry) []ModuleMount {
	if entry.Mount == "" {
		return nil
	}
	return []ModuleMount{{Name: entry.Name, Key: entry.Mount}}
}

func ParseModuleMounts(raw string) ([]ModuleMount, error) {
	if strings.TrimSpace(raw) == "" {
		return nil, nil
	}
	var mounts []ModuleMount
	if err := json.Unmarshal([]byte(raw), &mounts); err != nil {
		return nil, ErrInvalidMounts
	}
	return mounts, nil
}

func EffectiveModuleMounts(code, stored string) []ModuleMount {
	mounts, err := ParseModuleMounts(stored)
	if err == nil && len(mounts) > 0 {
		return mounts
	}
	entry, ok := CatalogEntry(code)
	if !ok {
		return nil
	}
	return DefaultModuleMounts(entry)
}

func MaxMountsFor(entry ModuleCatalogEntry) int {
	switch {
	case entry.Mountable:
		return MaxModuleMounts
	case entry.Mount != "":
		return 1
	default:
		return 0
	}
}

func ValidateModuleMounts(code string, mounts []ModuleMount) error {
	if len(mounts) == 0 {
		return nil
	}
	entry, ok := CatalogEntry(code)
	if !ok || len(mounts) > MaxMountsFor(entry) {
		return ErrInvalidMounts
	}
	names := make(map[string]bool, len(mounts))
	keys := make(map[string]bool, len(mounts))
	for _, mount := range mounts {
		name := strings.TrimSpace(mount.Name)
		if name == "" || name != mount.Name || utf8.RuneCountInString(name) > MaxMountNameLength {
			return ErrInvalidMounts
		}
		if strings.IndexFunc(name, unicode.IsControl) >= 0 {
			return ErrInvalidMounts
		}
		folded := strings.ToLower(name)
		if names[folded] {
			return ErrInvalidMounts
		}
		names[folded] = true
		if mount.Key == "" || keys[mount.Key] {
			return ErrInvalidMounts
		}
		keys[mount.Key] = true
		if mount.Icon != "" && !ModuleIcons[mount.Icon] {
			return ErrInvalidMounts
		}
	}
	return nil
}

func MountKeyFromName(name string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(name) {
		switch {
		case r >= 'a' && r <= 'z':
			b.WriteRune(r)
		case r >= '0' && r <= '9' && b.Len() > 0:
			b.WriteRune(r)
		}
	}
	if b.Len() == 0 {
		return "mount"
	}
	return b.String()
}
