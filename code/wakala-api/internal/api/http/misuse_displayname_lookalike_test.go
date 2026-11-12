package http

import (
	"net/http"
	"testing"
)

func setDisplayName(t *testing.T, w stepRunWalk, person, name string) int {
	t.Helper()
	rec := w.call(t, "PUT", "/instances/"+w.instance+"/me/name", map[string]any{"display_name": name}, w.people[person])
	return rec.Code
}

func TestDisplayName_ANameThatLooksLikeAnotherMembersNameIsRefused(t *testing.T) {
	w := newStepRunWalk(t, referralPlan(), "Volunteer", "Liaison")
	if code := setDisplayName(t, w, "Liaison", "Pap Irén"); code != http.StatusOK {
		t.Fatalf("liaison sets own name: %d", code)
	}
	lookalikes := map[string]string{
		"lower case":            "pap irén",
		"upper case":            "PAP IRÉN",
		"cyrillic capital er":   "Рap Irén",
		"cyrillic small a":      "Pаp Irén",
		"cyrillic e with acute": "Pap Irе́n",
		"greek small rho":       "Paρ Irén",
		"full width":            "Ｐap Irén",
		"double space":          "Pap  Irén",
		"trailing dot":          "Pap Irén.",
		"decomposed accent":     "Pap Irén",
	}
	for label, name := range lookalikes {
		t.Run(label, func(t *testing.T) {
			if code := setDisplayName(t, w, "Volunteer", name); code != http.StatusConflict {
				t.Fatalf("volunteer takes %q: %d, want %d", name, code, http.StatusConflict)
			}
		})
	}
}

func TestDisplayName_ARealDifferentNameIsAdmittedAndOwnNameCanBeSetAgain(t *testing.T) {
	w := newStepRunWalk(t, referralPlan(), "Volunteer", "Liaison")
	if code := setDisplayName(t, w, "Liaison", "Pap Irén"); code != http.StatusOK {
		t.Fatalf("liaison sets own name: %d", code)
	}
	if code := setDisplayName(t, w, "Liaison", "Pap Irén"); code != http.StatusOK {
		t.Fatalf("liaison sets the same name again: %d", code)
	}
	for _, name := range []string{"Pap Iren", "Papp Irén", "Kovács Anna", "Őze Ödön"} {
		if code := setDisplayName(t, w, "Volunteer", name); code != http.StatusOK {
			t.Fatalf("volunteer takes the different name %q: %d", name, code)
		}
	}
}

func TestDisplayName_ANameThatLooksLikeARoleNameIsRefused(t *testing.T) {
	w := newStepRunWalk(t, referralPlan(), "Volunteer", "Liaison")
	for label, name := range map[string]string{
		"exact":             "Liaison",
		"lower case":        "liaison",
		"cyrillic small i":  "Lіaison",
		"cyrillic small a":  "Liаison",
		"cyrillic small o":  "Liaisоn",
		"spaced and dotted": "Liaison .",
	} {
		t.Run(label, func(t *testing.T) {
			if code := setDisplayName(t, w, "Volunteer", name); code != http.StatusConflict {
				t.Fatalf("volunteer takes the role name %q: %d, want %d", name, code, http.StatusConflict)
			}
		})
	}
}
