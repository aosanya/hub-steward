package approvals

import (
	"reflect"
	"testing"
)

func TestDecodeObjectAcceptsOneObjectAndNothingElse(t *testing.T) {
	good, ok := decodeObject(`{"n":12345678901234567890}`)
	if !ok || good["n"].(interface{ String() string }).String() != "12345678901234567890" {
		t.Errorf("a big number must survive unchanged: %v %v", good, ok)
	}
	for _, bad := range []string{``, `[]`, `3`, `null`, `{"a":1} x`, `{"a":1}{"b":2}`, `{`} {
		if _, ok := decodeObject(bad); ok {
			t.Errorf("%q was accepted", bad)
		}
	}
}

func TestEncodeObjectKeepsAngleBracketsAndDropsTheTrailingNewline(t *testing.T) {
	got, err := encodeObject(map[string]any{"html": "<b>&</b>"})
	if err != nil || got != `{"html":"<b>&</b>"}` {
		t.Errorf("got %q err %v", got, err)
	}
	if _, err := encodeObject(map[string]any{"bad": make(chan int)}); err == nil {
		t.Error("an unencodable value must be an error")
	}
}

func TestMergePatchReplacesScalarsDeletesNullsAndMergesNestedObjects(t *testing.T) {
	target := map[string]any{"a": 1, "gone": true, "o": map[string]any{"keep": 1, "swap": 1}, "scalar": "was"}
	mergePatch(target, map[string]any{"a": 2, "gone": nil, "o": map[string]any{"swap": 2, "new": map[string]any{"deep": 1}}, "scalar": map[string]any{"now": "object"}, "fresh": []any{1}})
	want := map[string]any{
		"a":      2,
		"o":      map[string]any{"keep": 1, "swap": 2, "new": map[string]any{"deep": 1}},
		"scalar": map[string]any{"now": "object"},
		"fresh":  []any{1},
	}
	if !reflect.DeepEqual(target, want) {
		t.Errorf("target = %v\nwant   %v", target, want)
	}
}
