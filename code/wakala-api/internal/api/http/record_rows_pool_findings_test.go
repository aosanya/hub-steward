package http

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
	"testing"

	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

func poolIsNot(question, value string) poolCondition {
	return poolCondition{"question": question, "operator": "is_not", "value": value}
}

func poolWith(question, operator, value string) poolCondition {
	return poolCondition{"question": question, "operator": operator, "value": value}
}

func TestPoolSearch_IsOnAMultiSelectMeansTheOptionIsOneOfThoseHeld(t *testing.T) {
	p := consultantPool(t)

	p.found(t, "is names one held option, not the whole answer", []poolCondition{poolIs("Countries", "kenya")},
		"Zawadi Ndwiga", "Baraka Otieno", "Imani Kasongo", "Neema Sawe", "Jabari Mushi", "Rehema Kimaro", "Salim Abdalla")
	p.found(t, "is on an option held only inside a list", []poolCondition{poolIs("Expertise areas", "Food security")}, "Jabari Mushi")
	p.found(t, "is on a piece of an option", []poolCondition{poolIs("Expertise areas", "Financial")})
	p.found(t, "is on a single choice stays the whole answer", []poolCondition{poolIs("Band", "b")}, "Zawadi Ndwiga", "Neema Sawe", "Salim Abdalla")
}

func TestPoolSearch_IsNotOnAMultiSelectExcludesEveryoneWhoHoldsTheOption(t *testing.T) {
	p := consultantPool(t)

	p.found(t, "is_not Food security leaves out the one who holds it", []poolCondition{poolIsNot("Expertise areas", "Food security")},
		"Zawadi Ndwiga", "Baraka Otieno", "Imani Kasongo", "Neema Sawe", "Tendai Moyo", "Rehema Kimaro", "Salim Abdalla")
	p.found(t, "is_not Kenya leaves out everyone who holds Kenya among others", []poolCondition{poolIsNot("Countries", "Kenya")}, "Tendai Moyo")
	p.found(t, "is_not on an option nobody holds keeps all eight", []poolCondition{poolIsNot("Countries", "Uganda"), poolIsNot("Countries", "Senegal")},
		"Zawadi Ndwiga", "Imani Kasongo", "Neema Sawe", "Tendai Moyo", "Rehema Kimaro", "Salim Abdalla")
	p.found(t, "is_not on a single choice stays the whole answer", []poolCondition{poolIsNot("Band", "B")}, "Baraka Otieno", "Imani Kasongo", "Jabari Mushi", "Tendai Moyo", "Rehema Kimaro")
}

func TestPoolSearch_AValueNoOptionCanBeIsRefusedOnAMultiSelect(t *testing.T) {
	p := consultantPool(t)
	for _, operator := range []string{"is", "is_not", "contains"} {
		if names, why := p.search(t, "test-owner", poolWith("Countries", operator, "Kenya; Rwanda")); why == "" {
			t.Errorf("%s with two options in one value: want a refusal, got %v", operator, names)
		}
	}
	p.found(t, "a value with a semicolon on a free text question is a piece of text", []poolCondition{poolContains("Name", "a;b")})
}

func TestPoolSearch_TheNumberOfConditionsAndTheSizeOfOneAreLimited(t *testing.T) {
	p := consultantPool(t)
	many := func(n int) []poolCondition {
		out := make([]poolCondition, n)
		for i := range out {
			out[i] = poolContains("Countries", "Kenya")
		}
		return out
	}

	if _, why := p.search(t, "test-owner", many(maxWhereConditions)...); why != "" {
		t.Errorf("%d conditions are within the limit, refused with %q", maxWhereConditions, why)
	}
	_, why := p.search(t, "test-owner", many(maxWhereConditions+1)...)
	if why == "" || !strings.Contains(why, "at most") {
		t.Errorf("%d conditions: want a refusal saying at most %d, got %q", maxWhereConditions+1, maxWhereConditions, why)
	}
	if _, why := p.search(t, "test-owner", poolContains("Name", strings.Repeat("a", maxConditionValueLength+1))); why == "" {
		t.Error("a value past the limit: want a refusal")
	}
	if _, why := p.search(t, "test-owner", poolContains("Name", strings.Repeat("a", maxConditionValueLength))); why != "" {
		t.Errorf("a value at the limit refused with %q", why)
	}
}

func TestPoolSearch_ARefusalDoesNotEchoALongQuestionNameOrOperatorWhole(t *testing.T) {
	p := consultantPool(t)
	long := strings.Repeat("x", 100000)
	for name, condition := range map[string]poolCondition{
		"a long question name": poolIs(long, "red"),
		"a long operator":      {"question": "Status", "operator": long, "value": "Active"},
	} {
		_, why := p.search(t, "test-owner", condition)
		if why == "" {
			t.Errorf("%s: want a refusal", name)
		}
		if len(why) > 400 {
			t.Errorf("%s: the refusal is %d characters long, want it cut", name, len(why))
		}
	}
}

func TestPoolSearch_ARefusalNamesTheConditionThatCausedIt(t *testing.T) {
	p := consultantPool(t)
	cases := map[string]struct {
		where []poolCondition
		want  string
	}{
		"the second of two":  {[]poolCondition{poolIs("Status", "Active"), poolIs("Colour", "red")}, "condition 2"},
		"the third of three": {[]poolCondition{poolIs("Status", "Active"), poolIs("Band", "A"), poolOnOrBefore("Free from", "March")}, "condition 3"},
		"the first":          {[]poolCondition{poolIs("Status", " ")}, "condition 1"},
	}
	for name, c := range cases {
		if _, why := p.search(t, "test-owner", c.where...); !strings.Contains(why, c.want) {
			t.Errorf("%s: the refusal %q does not name %q", name, why, c.want)
		}
	}
}

func TestPoolSearch_AConditionTheQuestionsTypeCannotAnswerIsRefused(t *testing.T) {
	p := consultantPool(t)
	refused := map[string]poolCondition{
		"more_than on free text":      poolWith("Name", "more_than", "5"),
		"on_or_before on free text":   poolOnOrBefore("Name", "2027-01-01"),
		"on_or_after on a single":     poolOnOrAfter("Band", "2027-01-01"),
		"more_than on a date":         poolWith("Free from", "more_than", "2027"),
		"less_than on a multi-select": poolWith("Countries", "less_than", "3"),
	}
	for name, condition := range refused {
		if names, why := p.search(t, "test-owner", condition); why == "" {
			t.Errorf("%s: want a refusal, got %v", name, names)
		}
	}
}

func TestPoolSearch_TheOperatorIsReadInAnyLetterCase(t *testing.T) {
	p := consultantPool(t)
	p.found(t, "an operator in capitals", []poolCondition{poolWith("Free from", "ON_OR_BEFORE", "2027-02-01")}, "Baraka Otieno", "Neema Sawe", "Salim Abdalla")
	p.found(t, "an operator with a capital", []poolCondition{poolWith("Countries", "Contains", "rwanda")}, "Imani Kasongo")
}

func TestPoolSearch_TheRestListRefusesAWhereItWouldIgnore(t *testing.T) {
	p := consultantPool(t)
	where, err := json.Marshal([]poolCondition{poolIs("Status", "Retired")})
	if err != nil {
		t.Fatalf("encode: %v", err)
	}
	path := "/instances/" + p.instance + "/live-records/" + p.pool + "/rows?" + url.Values{"where": {string(where)}}.Encode()
	if rec := p.call(t, "GET", path, nil, p.owner); rec.Code != http.StatusBadRequest {
		t.Errorf("GET with where: %d %s, want 400 saying only the tool filters", rec.Code, rec.Body.String())
	}
}

func TestPoolSearch_ACallerHoldingNoViewCodeGainsNoRowThroughWhere(t *testing.T) {
	b := businessRegister(t)
	b.addBusiness(t, "Alpha Bakery", b.alpha, "shared contact", "", "")
	b.addBusiness(t, "Beta Garage", b.beta, "shared contact", "", "")
	sharedContact := []map[string]string{{"question": "Contact", "operator": "is", "value": "shared contact"}}
	betaOnly := []map[string]string{{"question": "Business", "operator": "contains", "value": "Beta"}}

	expectBusinesses(t, "member alpha with no condition", b.businessesOverTool(t, b.alpha, nil))
	expectBusinesses(t, "member alpha with a condition both rows meet", b.businessesOverTool(t, b.alpha, map[string]any{"where": sharedContact}))
	expectBusinesses(t, "member alpha with a condition only the other member's row meets", b.businessesOverTool(t, b.alpha, map[string]any{"where": betaOnly}))
	expectBusinesses(t, "member beta with the same condition", b.businessesOverTool(t, b.beta, map[string]any{"where": betaOnly}))
	expectBusinesses(t, "the adding role with the same condition", b.businessesOverTool(t, "test-owner", map[string]any{"where": betaOnly}), "Beta Garage")
	expectBusinesses(t, "the adding role with a condition both meet", b.businessesOverTool(t, "test-owner", map[string]any{"where": sharedContact}), "Alpha Bakery", "Beta Garage")
}

func TestPoolSearch_AMultiSelectSentThroughAStepIsFoundByTheSearchForEachOption(t *testing.T) {
	w := multiSelectWalk(t)
	code, body := w.send(t, map[string]any{"answers": map[string]any{"Symptoms": []string{"Fever", "Rash, itchy"}}})
	if code != http.StatusCreated {
		t.Fatalf("submit: %d %s", code, body)
	}
	var sent stepAnswersResult
	if err := json.Unmarshal([]byte(body), &sent); err != nil {
		t.Fatalf("decode %q: %v", body, err)
	}
	if got := w.savedAnswer(t, "Symptoms"); got != "Fever; Rash, itchy" {
		t.Errorf("saved %q, want the options joined with a semicolon and a space as the search reads them", got)
	}
	for _, option := range []string{"Fever", "Rash, itchy"} {
		out := designAgentWalk{stepRunWalk: w}.mcpCall(t, "test-owner", listLiveRecordRowsTool, map[string]any{
			"instance_id": w.instance, "record_code": sent.RecordCode,
			"where": []poolCondition{poolContains("Symptoms", option)},
		})
		if out.IsError {
			t.Fatalf("search for %q refused: %s", option, toolErrorText(out))
		}
		encoded, _ := json.Marshal(out.StructuredContent)
		var found struct {
			Items []agencymodels.RecordRow `json:"items"`
		}
		if err := json.Unmarshal(encoded, &found); err != nil || len(found.Items) != 1 {
			t.Errorf("contains %q found %s, want the one row the step wrote", option, encoded)
		}
	}
}
