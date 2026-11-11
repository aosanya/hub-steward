package http

import (
	"net/http"
	"testing"
)

var hungarianSheet = map[string][]map[string]string{
	"mechanics": {
		{"key": "purpose", "text": "A lakosok véleményét a település ügyeinek előkészítéséhez használjuk."},
		{"key": "withdraw", "text": "A hozzájárulást bármikor, indoklás nélkül vissza lehet vonni."},
	},
	"appendix": {
		{"key": "storage", "text": "Az adatokat csak a település ügyintézői látják, és csak addig őrizzük, amíg az ügy tart."},
	},
	"public_sheet": {
		{"key": "summary", "text": "Röviden: kérdezünk, ön válaszol, és a válasza nem kerül harmadik félhez."},
	},
}

func publishHungarianSheet(t *testing.T, cw consentWalk) map[string]string {
	t.Helper()
	base := "/instances/" + cw.instance + "/custody"
	ids := map[string]string{}
	for scope, clauses := range hungarianSheet {
		created := cw.call(t, "POST", base+"/consent/versions", map[string]any{"scope": scope, "version": "v1", "language": "hu", "clauses": clauses}, cw.owner)
		if created.Code != http.StatusCreated {
			t.Fatalf("owner writes the %s sheet in Hungarian: %d %s, want 201", scope, created.Code, created.Body.String())
		}
		id, _ := decodeObject(t, created)["id"].(string)
		ids[scope] = id
		published := cw.call(t, "POST", base+"/consent/versions/"+id+"/publish", map[string]any{}, cw.owner)
		if published.Code != http.StatusOK && published.Code != http.StatusCreated {
			t.Fatalf("owner publishes the %s sheet in Hungarian: %d %s", scope, published.Code, published.Body.String())
		}
	}
	return ids
}

func TestConsentHungarian_ResidentReadsEveryScopeOfTheSheetInHungarian(t *testing.T) {
	cw := newConsentWalk(t)
	ids := publishHungarianSheet(t, cw)
	base := "/instances/" + cw.instance + "/custody"

	for scope, clauses := range hungarianSheet {
		got := cw.call(t, "GET", base+"/consent/versions/in-force/"+scope+"/hu", nil, cw.resident)
		if got.Code != http.StatusOK {
			t.Fatalf("resident reads %s in Hungarian: %d %s, want 200", scope, got.Code, got.Body.String())
		}
		sheet := decodeObject(t, got)
		if sheet["id"] != ids[scope] || sheet["language"] != "hu" {
			t.Fatalf("%s in force = %v, want version %s in hu", scope, sheet, ids[scope])
		}
		read, _ := sheet["clauses"].([]any)
		if len(read) != len(clauses) {
			t.Fatalf("%s clauses = %d, want %d", scope, len(read), len(clauses))
		}
		first, _ := read[0].(map[string]any)
		if first["text"] != clauses[0]["text"] {
			t.Fatalf("%s first clause = %v, want %q", scope, first["text"], clauses[0]["text"])
		}
	}
}

func TestConsentHungarian_ResidentAgreesInHungarianAndIsStampedWithBothHalves(t *testing.T) {
	cw := newConsentWalk(t)
	ids := publishHungarianSheet(t, cw)
	base := "/instances/" + cw.instance + "/custody"

	agreed := cw.call(t, "POST", base+"/consent/agree", map[string]any{"language": "hu"}, cw.resident)
	if agreed.Code != http.StatusCreated && agreed.Code != http.StatusOK {
		t.Fatalf("resident agrees in Hungarian: %d %s", agreed.Code, agreed.Body.String())
	}
	record := decodeObject(t, agreed)
	if record["language"] != "hu" || record["mechanics_version_id"] != ids["mechanics"] || record["appendix_version_id"] != ids["appendix"] {
		t.Fatalf("consent record = %v, want hu with mechanics %s and appendix %s", record, ids["mechanics"], ids["appendix"])
	}
}

func TestConsentHungarian_ASheetInAnotherScopeNameIsNotFoundNotAnError(t *testing.T) {
	cw := newConsentWalk(t)
	publishHungarianSheet(t, cw)
	base := "/instances/" + cw.instance + "/custody"

	got := cw.call(t, "GET", base+"/consent/versions/in-force/forms/hu", nil, cw.resident)
	if got.Code != http.StatusNotFound {
		t.Fatalf("resident reads a scope that is not a scope: %d %s, want 404", got.Code, got.Body.String())
	}
}

func TestConsentHungarian_AResidentWhoReadsEnglishIsNotShownTheHungarianSheet(t *testing.T) {
	cw := newConsentWalk(t)
	publishHungarianSheet(t, cw)
	base := "/instances/" + cw.instance + "/custody"

	got := cw.call(t, "GET", base+"/consent/versions/in-force/mechanics/en", nil, cw.resident)
	if got.Code != http.StatusNotFound {
		t.Fatalf("resident reads English with only Hungarian published: %d %s, want 404", got.Code, got.Body.String())
	}
}

func TestConsentHungarian_AHungarianAgencyResidentAgreesWithoutNamingALanguage(t *testing.T) {
	cw := newConsentWalk(t)
	ids := publishHungarianSheet(t, cw)
	base := "/instances/" + cw.instance + "/custody"

	set := cw.call(t, "PUT", "/instances/"+cw.instance+"/languages", map[string]any{"studio_default": "HU", "content": []string{"HU"}, "content_default": "HU"}, cw.owner)
	if set.Code != http.StatusOK {
		t.Fatalf("owner sets the agency to Hungarian: %d %s", set.Code, set.Body.String())
	}

	agreed := cw.call(t, "POST", base+"/consent/agree", map[string]any{}, cw.resident)
	if agreed.Code != http.StatusCreated {
		t.Fatalf("resident agrees with no language in a Hungarian agency: %d %s, want 201", agreed.Code, agreed.Body.String())
	}
	record := decodeObject(t, agreed)
	if record["language"] != "hu" || record["mechanics_version_id"] != ids["mechanics"] {
		t.Fatalf("consent record = %v, want hu on mechanics %s", record, ids["mechanics"])
	}
}

func TestConsentHungarian_ALanguageTheResidentNamesBeatsTheAgencyDefault(t *testing.T) {
	cw := newConsentWalk(t)
	base := "/instances/" + cw.instance + "/custody"

	set := cw.call(t, "PUT", "/instances/"+cw.instance+"/languages", map[string]any{"studio_default": "HU", "content": []string{"HU", "EN"}, "content_default": "HU"}, cw.owner)
	if set.Code != http.StatusOK {
		t.Fatalf("owner sets the agency to Hungarian: %d %s", set.Code, set.Body.String())
	}
	for _, scope := range []string{"mechanics", "appendix"} {
		created := cw.call(t, "POST", base+"/consent/versions", map[string]any{"scope": scope, "version": "v1", "language": "en", "clauses": []map[string]string{{"key": "purpose", "text": "We use answers to prepare the town's decisions."}}}, cw.owner)
		if created.Code != http.StatusCreated {
			t.Fatalf("owner writes the %s sheet in English: %d %s", scope, created.Code, created.Body.String())
		}
		id, _ := decodeObject(t, created)["id"].(string)
		cw.call(t, "POST", base+"/consent/versions/"+id+"/publish", map[string]any{}, cw.owner)
	}

	agreed := cw.call(t, "POST", base+"/consent/agree", map[string]any{"language": "en"}, cw.resident)
	if agreed.Code != http.StatusCreated {
		t.Fatalf("resident names English in a Hungarian agency: %d %s, want 201", agreed.Code, agreed.Body.String())
	}
	if record := decodeObject(t, agreed); record["language"] != "en" {
		t.Fatalf("consent record language = %v, want en", record["language"])
	}
}

func TestConsentHungarian_ABodyThatIsNotAnObjectStaysAClientError(t *testing.T) {
	cw := newConsentWalk(t)
	publishHungarianSheet(t, cw)
	base := "/instances/" + cw.instance + "/custody"

	agreed := cw.call(t, "POST", base+"/consent/agree", []string{"hu"}, cw.resident)
	if agreed.Code < 400 || agreed.Code >= 500 {
		t.Fatalf("resident sends a list instead of an object: %d %s, want a 4xx", agreed.Code, agreed.Body.String())
	}
}
