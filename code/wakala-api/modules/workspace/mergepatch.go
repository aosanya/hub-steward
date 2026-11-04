package mwanachamaworkspace

import (
	"bytes"
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"wakalaserver/modules/workspace/models"
)

func decodeDocument(raw json.RawMessage) (any, error) {
	if len(bytes.TrimSpace(raw)) == 0 {
		return map[string]any{}, nil
	}
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.UseNumber()
	var v any
	if err := dec.Decode(&v); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidLayout, err)
	}
	return v, nil
}

func decodeObject(raw json.RawMessage) (map[string]any, error) {
	v, err := decodeDocument(raw)
	if err != nil {
		return nil, err
	}
	m, ok := v.(map[string]any)
	if !ok {
		return nil, ErrInvalidPatch
	}
	return m, nil
}

func encodeDocument(v any) (json.RawMessage, error) {
	raw, err := json.Marshal(v)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidLayout, err)
	}
	return json.RawMessage(raw), nil
}

func sortedNames(m map[string]any) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

func sameDocument(a, b any) bool {
	x, err := json.Marshal(a)
	if err != nil {
		return false
	}
	y, err := json.Marshal(b)
	if err != nil {
		return false
	}
	return bytes.Equal(x, y)
}

func applyPatch(target, patch any) any {
	p, ok := patch.(map[string]any)
	if !ok {
		return patch
	}
	t, ok := target.(map[string]any)
	if !ok {
		t = map[string]any{}
	}
	out := make(map[string]any, len(t)+len(p))
	for k, v := range t {
		out[k] = v
	}
	for k, v := range p {
		if v == nil {
			delete(out, k)
			continue
		}
		out[k] = applyPatch(out[k], v)
	}
	return out
}

func inverseOf(target, patch any) any {
	p, ok := patch.(map[string]any)
	if !ok {
		return target
	}
	t, _ := target.(map[string]any)
	out := make(map[string]any, len(p))
	for k, v := range p {
		held, there := t[k]
		if !there {
			out[k] = nil
			continue
		}
		if _, patchIsObject := v.(map[string]any); patchIsObject {
			if _, heldIsObject := held.(map[string]any); heldIsObject {
				out[k] = inverseOf(held, v)
				continue
			}
		}
		out[k] = held
	}
	return out
}

func escapeToken(s string) string {
	return strings.ReplaceAll(strings.ReplaceAll(s, "~", "~0"), "/", "~1")
}

func unescapeToken(s string) string {
	return strings.ReplaceAll(strings.ReplaceAll(s, "~1", "/"), "~0", "~")
}

func pointerTokens(pointer string) ([]string, error) {
	if pointer == "" {
		return nil, nil
	}
	if !strings.HasPrefix(pointer, "/") {
		return nil, fmt.Errorf("%w: %q does not start with /", ErrInvalidPointer, pointer)
	}
	parts := strings.Split(pointer[1:], "/")
	out := make([]string, len(parts))
	for i, s := range parts {
		out[i] = unescapeToken(s)
	}
	return out, nil
}

func atPointer(root any, tokens []string) (any, bool) {
	cur := root
	for _, t := range tokens {
		m, ok := cur.(map[string]any)
		if !ok {
			return nil, false
		}
		v, there := m[t]
		if !there {
			return nil, false
		}
		cur = v
	}
	return cur, true
}

func setPointer(root any, tokens []string, v any) any {
	if len(tokens) == 0 {
		return v
	}
	m, ok := root.(map[string]any)
	if !ok {
		m = map[string]any{}
	}
	out := make(map[string]any, len(m)+1)
	for k, held := range m {
		out[k] = held
	}
	out[tokens[0]] = setPointer(m[tokens[0]], tokens[1:], v)
	return out
}

func removePointer(root any, tokens []string) any {
	if len(tokens) == 0 {
		return nil
	}
	m, ok := root.(map[string]any)
	if !ok {
		return root
	}
	if _, there := m[tokens[0]]; !there {
		return root
	}
	out := make(map[string]any, len(m))
	for k, held := range m {
		out[k] = held
	}
	if len(tokens) == 1 {
		delete(out, tokens[0])
	} else {
		out[tokens[0]] = removePointer(m[tokens[0]], tokens[1:])
	}
	return out
}

func patchClearing(pointer string) (map[string]any, error) {
	tokens, err := pointerTokens(pointer)
	if err != nil {
		return nil, err
	}
	if len(tokens) == 0 {
		return nil, fmt.Errorf("%w: the whole document is not one path", ErrInvalidPointer)
	}
	out := map[string]any{}
	cur := out
	for _, t := range tokens[:len(tokens)-1] {
		next := map[string]any{}
		cur[t] = next
		cur = next
	}
	cur[tokens[len(tokens)-1]] = nil
	return out, nil
}

const lockField = "locks"

func locksOf(body any) []string {
	m, ok := body.(map[string]any)
	if !ok {
		return nil
	}
	raw, ok := m[lockField].([]any)
	if !ok {
		return nil
	}
	out := make([]string, 0, len(raw))
	for _, v := range raw {
		if s, ok := v.(string); ok && strings.HasPrefix(s, "/") {
			out = append(out, s)
		}
	}
	return out
}

func lockedAt(path string, locks []string) bool {
	for _, l := range locks {
		if l == "" {
			continue
		}
		if path == l || strings.HasPrefix(path, l+"/") {
			return true
		}
	}
	return false
}

func lockedUnder(path string, locks []string) bool {
	for _, l := range locks {
		if strings.HasPrefix(l, path+"/") {
			return true
		}
	}
	return false
}

func dropLocked(patch any, path string, locks []string, aside *[]string) (any, bool) {
	if lockedAt(path, locks) {
		*aside = append(*aside, path)
		return nil, false
	}
	obj, isObject := patch.(map[string]any)
	if !isObject {
		if path != "" && lockedUnder(path, locks) {
			*aside = append(*aside, path)
			return nil, false
		}
		return patch, true
	}
	out := map[string]any{}
	for _, k := range sortedNames(obj) {
		v, keep := dropLocked(obj[k], path+"/"+escapeToken(k), locks, aside)
		if keep {
			out[k] = v
		}
	}
	return out, true
}

func writeLocksBack(body, base any, locks []string) (any, error) {
	out := body
	for _, l := range locks {
		tokens, err := pointerTokens(l)
		if err != nil {
			return nil, err
		}
		if len(tokens) == 0 {
			continue
		}
		if v, there := atPointer(base, tokens); there {
			out = setPointer(out, tokens, v)
			continue
		}
		out = removePointer(out, tokens)
	}
	return out, nil
}

func leafLine(path string, from, to any) (models.LayoutLine, bool) {
	if sameDocument(from, to) {
		return models.LayoutLine{}, false
	}
	line := models.LayoutLine{Path: path}
	if from != nil {
		raw, err := encodeDocument(from)
		if err == nil {
			line.From = raw
		}
	}
	if to != nil {
		raw, err := encodeDocument(to)
		if err == nil {
			line.To = raw
		}
	}
	return line, true
}

func diffLines(target, patch any, path string, out *[]models.LayoutLine) {
	p, patchIsObject := patch.(map[string]any)
	t, targetIsObject := target.(map[string]any)
	if !patchIsObject || !targetIsObject {
		if line, changed := leafLine(path, target, patch); changed {
			*out = append(*out, line)
		}
		return
	}
	for _, k := range sortedNames(p) {
		diffLines(t[k], p[k], path+"/"+escapeToken(k), out)
	}
}

func asideLines(aside []string) []models.LayoutLine {
	out := make([]models.LayoutLine, 0, len(aside))
	for _, path := range aside {
		out = append(out, models.LayoutLine{
			Path:   path,
			Held:   true,
			Reason: "This part is locked where it is published, so it stays as it is.",
		})
	}
	return out
}

func sortedAside(aside []string) []string {
	seen := map[string]bool{}
	out := []string{}
	for _, p := range aside {
		if seen[p] {
			continue
		}
		seen[p] = true
		out = append(out, p)
	}
	sort.Strings(out)
	return out
}

func encodeAside(aside []string) (json.RawMessage, error) {
	if len(aside) == 0 {
		return nil, nil
	}
	raw, err := json.Marshal(aside)
	if err != nil {
		return nil, err
	}
	return json.RawMessage(raw), nil
}

func asideColumn(raw json.RawMessage) any {
	if len(raw) == 0 {
		return nil
	}
	return string(raw)
}

func decodeAside(raw json.RawMessage) []string {
	if len(bytes.TrimSpace(raw)) == 0 {
		return nil
	}
	var out []string
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil
	}
	return out
}
