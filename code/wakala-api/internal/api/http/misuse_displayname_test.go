package http

import "testing"

func TestCleanNameRefusesInvisibleAndDirectionCharacters(t *testing.T) {
	refused := map[string]string{
		"right-to-left override":     "Bela\u202egnirts",
		"left-to-right override":     "Bela\u202dgnirts",
		"left-to-right embedding":    "Bela\u202agnirts",
		"right-to-left embedding":    "Bela\u202bgnirts",
		"pop directional formatting": "Bela\u202cgnirts",
		"left-to-right isolate":      "Bela\u2066gnirts",
		"right-to-left isolate":      "Bela\u2067gnirts",
		"first strong isolate":       "Bela\u2068gnirts",
		"pop directional isolate":    "Bela\u2069gnirts",
		"zero width space":           "Anna\u200b",
		"zero width non-joiner":      "Anna\u200c",
		"zero width joiner":          "Anna\u200d",
		"left-to-right mark":         "Anna\u200e",
		"right-to-left mark":         "Anna\u200f",
		"line separator":             "Anna\u2028Kovács",
		"paragraph separator":        "Anna\u2029Kovács",
		"byte order mark":            "Anna\ufeff",
		"bell":                       "Anna\u0007",
	}
	for label, raw := range refused {
		t.Run(label, func(t *testing.T) {
			for _, field := range []string{"display name", "first name", "last name"} {
				if name, err := cleanName(field, raw); err == nil {
					t.Fatalf("%s %q was admitted as %q", field, raw, name)
				}
			}
		})
	}
}

func TestCleanNameAdmitsPlainNames(t *testing.T) {
	for _, raw := range []string{"Kovács Anna", "  Nagy Péter  ", "Őze Ödön", "Anna-Mária O'Neil"} {
		if _, err := cleanName("display name", raw); err != nil {
			t.Fatalf("%q was refused: %v", raw, err)
		}
	}
}
