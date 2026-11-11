package http

import (
	"fmt"
	"net/http"
	"testing"
)

var blankDrawingFillers = map[string]string{
	"hangul filler":             "\u3164",
	"halfwidth hangul filler":   "\uffa0",
	"hangul choseong filler":    "\u115f",
	"hangul jungseong filler":   "\u1160",
	"braille pattern blank":     "\u2800",
	"private use":               "\ue000",
	"combining grapheme joiner": "\u034f",
	"khmer inherent vowel":      "\u17b4",
	"variation selector":        "\ufe0f",
	"mongolian free variation":  "\u180b",
	"unassigned code point":     "\u0378",
	"plane 15 private use":      "\U000f0000",
}

func TestDisplayName_ResidentCannotDoSetANameThatDrawsNothing(t *testing.T) {
	w := newStepRunWalk(t, referralPlan(), "Liaison")
	path := "/instances/" + w.instance + "/me/name"
	resident := w.people["Liaison"]

	for label, filler := range blankDrawingFillers {
		t.Run(label, func(t *testing.T) {
			for _, name := range []string{filler, filler + filler + filler, "Anna" + filler + "Polgármester"} {
				if rec := w.call(t, "PUT", path, map[string]any{"display_name": name}, resident); rec.Code != http.StatusBadRequest {
					t.Fatalf("resident naming themselves %q: %d %s, want 400", name, rec.Code, rec.Body.String())
				}
			}
			for _, field := range []string{"first_name", "last_name"} {
				if rec := w.call(t, "PUT", path, map[string]any{field: filler}, resident); rec.Code != http.StatusBadRequest {
					t.Fatalf("resident setting %s to %q: %d %s, want 400", field, filler, rec.Code, rec.Body.String())
				}
			}
		})
	}
}

func TestGroupName_OwnerCannotDoNameAGroupWithCharactersThatDrawNothing(t *testing.T) {
	w := newStepRunWalk(t, nil)
	groups := "/instances/" + w.instance + "/actor/groups"

	for label, filler := range blankDrawingFillers {
		t.Run(label, func(t *testing.T) {
			for _, name := range []string{filler, filler + filler + filler, "Anna" + filler + "Polgármester"} {
				if rec := w.call(t, "POST", groups, map[string]any{"name": name}, w.owner); rec.Code != http.StatusBadRequest {
					t.Fatalf("owner naming a group %q: %d %s, want 400", name, rec.Code, rec.Body.String())
				}
			}
		})
	}
}

func TestGroupName_OwnerCannotDoRenameAGroupToCharactersThatDrawNothing(t *testing.T) {
	w := newStepRunWalk(t, nil)
	groups := "/instances/" + w.instance + "/actor/groups"

	rec := w.call(t, "POST", groups, map[string]any{"name": "Kertváros körzet"}, w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("owner creates a group: %d %s", rec.Code, rec.Body.String())
	}
	created := decodeObject(t, rec)
	id, _ := created["id"].(string)
	if id == "" {
		t.Fatalf("read the new group: %s", rec.Body.String())
	}
	for _, name := range []string{"\u3164\u3164\u3164", "\u2800", "Kert\u3164város"} {
		if rec := w.call(t, "PATCH", groups+"/"+id, map[string]any{"name": name}, w.owner); rec.Code != http.StatusBadRequest {
			t.Fatalf("owner renaming the group to %q: %d %s, want 400", name, rec.Code, rec.Body.String())
		}
	}
}

func TestNames_PeopleCanDoKeepRealHungarianNames(t *testing.T) {
	w := newStepRunWalk(t, referralPlan(), "Liaison")
	path := "/instances/" + w.instance + "/me/name"
	groups := "/instances/" + w.instance + "/actor/groups"

	for i, name := range []string{
		"Kovács Anna", "Őze Ödön", "Nagy Péter", "Szűcs Ádám", "Árvíztűrő Tükörfúrógép",
		"Ko\u0301va\u0301cs Anna", "O\u030bze O\u0308do\u0308n", "Szűcs", "Anna-Mária O'Neil", "Jr. 2.",
	} {
		if rec := w.call(t, "PUT", path, map[string]any{"display_name": name}, w.people["Liaison"]); rec.Code != http.StatusOK {
			t.Fatalf("resident naming themselves %q: %d %s, want 200", name, rec.Code, rec.Body.String())
		}
		if rec := w.call(t, "POST", groups, map[string]any{"name": fmt.Sprintf("Csoport %d %s", i, name)}, w.owner); rec.Code != http.StatusCreated {
			t.Fatalf("owner naming a group %q: %d %s, want 201", name, rec.Code, rec.Body.String())
		}
	}
}

func TestDisplayName_ResidentCannotDoSetANameOfOnlyMarks(t *testing.T) {
	w := newStepRunWalk(t, referralPlan(), "Liaison")
	path := "/instances/" + w.instance + "/me/name"

	for _, name := range []string{"\u0301", "\u0301\u030b", " \u0301 "} {
		if rec := w.call(t, "PUT", path, map[string]any{"display_name": name}, w.people["Liaison"]); rec.Code != http.StatusBadRequest {
			t.Fatalf("resident naming themselves %q: %d %s, want 400", name, rec.Code, rec.Body.String())
		}
	}
}
