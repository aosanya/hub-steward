package http

import (
	"encoding/json"
	"net/http"
	"testing"
)

type proposedFieldCodeView struct {
	Record string `json:"record"`
	Key    string `json:"key"`
	Prompt string `json:"prompt"`
	Code   string `json:"code"`
}

type proposalImport struct {
	Proposals []proposedFieldCodeView `json:"field_codes"`
	Errors    []string                `json:"errors"`
}

func importForProposals(t *testing.T, questions []any) proposalImport {
	t.Helper()
	doc := tenderRolePermissions("report.read")
	doc["records"].([]any)[0].(map[string]any)["questions"] = questions
	w := newStepRunWalk(t, nil)
	rec := w.call(t, "POST", "/instances/import", importBodyOf(t, doc), w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("import: %d %s", rec.Code, rec.Body.String())
	}
	var got proposalImport
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode import result: %v", err)
	}
	if len(got.Errors) > 0 {
		t.Fatalf("import errors: %v", got.Errors)
	}
	return got
}

func promptQuestion(prompt string) map[string]any {
	return map[string]any{"prompt": prompt, "answer_type": "free_text"}
}

func codedQuestion(prompt, code string) map[string]any {
	return map[string]any{"prompt": prompt, "code": code, "answer_type": "free_text"}
}

func codesProposedFor(got proposalImport, record string) map[string]string {
	byPrompt := map[string]string{}
	for _, p := range got.Proposals {
		if p.Record == record {
			byPrompt[p.Prompt] = p.Code
		}
	}
	return byPrompt
}

func TestTheImportProposesAReadableCodeForAFieldWithNone(t *testing.T) {
	got := importForProposals(t, []any{promptQuestion("Closing date"), promptQuestion("Amount (USD)!")})
	proposed := codesProposedFor(got, "tender")
	if proposed["Closing date"] != "closing_date" || proposed["Amount (USD)!"] != "amount_usd" {
		t.Fatalf("proposals for tender are %v, want closing_date and amount_usd", proposed)
	}
}

func TestTheImportNumbersTheProposalOfAFieldWhosePromptClashes(t *testing.T) {
	got := importForProposals(t, []any{promptQuestion("Closing date"), promptQuestion("Closing date")})
	var codes []string
	for _, p := range got.Proposals {
		codes = append(codes, p.Code)
	}
	if len(codes) != 2 || codes[0] != "closing_date" || codes[1] != "closing_date_2" {
		t.Fatalf("proposals are %v, want closing_date then closing_date_2", codes)
	}
}

func TestTheImportKeepsACodeTheFileNamesAndProposesNothingForIt(t *testing.T) {
	got := importForProposals(t, []any{codedQuestion("Closing date", "deadline"), promptQuestion("Issuer")})
	proposed := codesProposedFor(got, "tender")
	if _, listed := proposed["Closing date"]; listed {
		t.Fatalf("the file named deadline for Closing date and %v lists it as a proposal", proposed)
	}
	if proposed["Issuer"] != "issuer" {
		t.Fatalf("proposals are %v, want issuer for Issuer", proposed)
	}
}

func TestEveryProposalCarriesTheHiddenKeyOfItsField(t *testing.T) {
	got := importForProposals(t, []any{promptQuestion("Closing date")})
	if len(got.Proposals) != 1 || got.Proposals[0].Key == "" {
		t.Fatalf("proposals are %+v, want one with the field's hidden key", got.Proposals)
	}
}

func TestTheImportProposesCodesForTheFieldsOfARecordAStepDerives(t *testing.T) {
	doc := tenderRolePermissions("report.read")
	doc["work_items"] = append(doc["work_items"].([]any),
		map[string]any{
			"id": "s1", "code": "WI-1", "workflow_id": "wf-tenders", "title": "Look at the tenders", "ordinality": 1,
			"kind": "fill_form", "role_id": "role-bid", "form_name": "Look", "record_code": "look",
			"questions": []any{promptQuestion("Seen on")},
		},
	)
	w := newStepRunWalk(t, nil)
	rec := w.call(t, "POST", "/instances/import", importBodyOf(t, doc), w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("import: %d %s", rec.Code, rec.Body.String())
	}
	var got proposalImport
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode import result: %v", err)
	}
	if proposed := codesProposedFor(got, "look"); proposed["Seen on"] != "seen_on" {
		t.Fatalf("proposals for look are %v, want seen_on", proposed)
	}
}
