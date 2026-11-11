package http

import (
	"net/http"
	"strings"
	"testing"
)

func formsBase(cw consentWalk) string {
	return "/instances/" + cw.instance + "/forms/forms"
}

func TestFormsAuthor_ACreatedFormNamesTheSessionAndNoOneElseOnItsAuthorityStamps(t *testing.T) {
	cw := newConsentWalk(t)
	created := cw.call(t, "POST", formsBase(cw), map[string]any{
		"title": "Ward consultation", "closes_at": "2099-01-01T00:00:00Z", "originator_chapter_id": cw.groupID,
		"audience": "member", "collection_mode": "self",
		"created_by": "forged-clerk", "published_by": "forged-clerk", "closed_by": "forged-clerk",
		"submitted_by": "forged-clerk", "approved_by": "forged-clerk", "publishing_authority": "Forged office",
	}, cw.owner)
	if created.Code != http.StatusCreated {
		t.Fatalf("create form: %d %s", created.Code, created.Body.String())
	}
	form := decodeObject(t, created)
	if form["created_by"] != "test-owner" {
		t.Errorf("created_by is %v; want the session's test-owner, never the body's forged-clerk", form["created_by"])
	}
	for _, stamp := range []string{"published_by", "closed_by", "submitted_by", "approved_by", "publishing_authority"} {
		if got, _ := form[stamp].(string); got != "" {
			t.Errorf("a new draft carries %s %q from the body; want it empty", stamp, got)
		}
	}
}

func TestFormsAuthor_EditingADraftCannotRewriteWhoCreatedItOrStampAnAuthorityAct(t *testing.T) {
	cw := newConsentWalk(t)
	created := cw.call(t, "POST", formsBase(cw), map[string]any{
		"title": "Ward consultation", "closes_at": "2099-01-01T00:00:00Z", "originator_chapter_id": cw.groupID,
		"audience": "member", "collection_mode": "self",
	}, cw.owner)
	if created.Code != http.StatusCreated {
		t.Fatalf("create form: %d %s", created.Code, created.Body.String())
	}
	id, _ := decodeObject(t, created)["id"].(string)
	edited := cw.call(t, "PATCH", formsBase(cw)+"/"+id, map[string]any{
		"title": "Ward consultation, second draft", "closes_at": "2099-01-01T00:00:00Z",
		"audience": "member", "collection_mode": "self",
		"created_by": "forged-clerk", "published_by": "forged-clerk", "closed_by": "forged-clerk",
		"submitted_by": "forged-clerk", "approved_by": "forged-clerk", "status": "open",
	}, cw.owner)
	if edited.Code != http.StatusOK {
		t.Fatalf("edit form: %d %s", edited.Code, edited.Body.String())
	}
	form := decodeObject(t, edited)
	if form["created_by"] != "test-owner" {
		t.Errorf("created_by is %v after an edit; want the session's test-owner", form["created_by"])
	}
	for _, stamp := range []string{"published_by", "closed_by", "submitted_by", "approved_by"} {
		if got, _ := form[stamp].(string); got != "" {
			t.Errorf("an edit stamped %s %q from the body; want it empty", stamp, got)
		}
	}
	if form["status"] != "draft" {
		t.Errorf("an edit moved the form to %v; want draft", form["status"])
	}
}

func TestFormsAuthor_APublishedFormNamesTheSessionAsPublisherNotTheBody(t *testing.T) {
	cw := newConsentWalk(t)
	formID, _ := openFormForGroup(t, cw)
	read := cw.call(t, "GET", formsBase(cw)+"/"+formID, nil, cw.owner)
	if read.Code != http.StatusOK {
		t.Fatalf("read form: %d %s", read.Code, read.Body.String())
	}
	if by := decodeObject(t, read)["published_by"]; by != "test-owner" {
		t.Errorf("published_by is %v; want the session's test-owner", by)
	}

	second := cw.call(t, "POST", formsBase(cw), map[string]any{
		"title": "Second", "closes_at": "2099-01-01T00:00:00Z", "originator_chapter_id": cw.groupID,
		"audience": "member", "collection_mode": "self",
	}, cw.owner)
	secondID, _ := decodeObject(t, second)["id"].(string)
	cw.call(t, "POST", formsBase(cw)+"/"+secondID+"/questions", map[string]any{"prompt": "Your view", "answer_type": "free_text"}, cw.owner)
	cw.call(t, "POST", formsBase(cw)+"/"+secondID+"/targets", map[string]any{"chapter_id": cw.groupID}, cw.owner)
	published := cw.call(t, "POST", formsBase(cw)+"/"+secondID+"/publish", map[string]any{"published_by": "forged-clerk"}, cw.owner)
	if published.Code != http.StatusOK && published.Code != http.StatusCreated {
		t.Fatalf("publish: %d %s", published.Code, published.Body.String())
	}
	again := cw.call(t, "GET", formsBase(cw)+"/"+secondID, nil, cw.owner)
	if by := decodeObject(t, again)["published_by"]; by != "test-owner" {
		t.Errorf("publish with a forged published_by stored %v; want the session's test-owner", by)
	}
}

func TestFormsAuthor_AnAnswerIsStoredForTheSignedInResidentNotTheBodysMember(t *testing.T) {
	cw := newConsentWalk(t)
	publishMechanicsConsent(t, cw)
	cw.call(t, "POST", "/instances/"+cw.instance+"/custody/consent/agree", map[string]any{}, cw.resident)
	formID, questionID := openFormForGroup(t, cw)
	path := formsBase(cw) + "/" + formID + "/answers"
	sent := cw.call(t, "POST", path, map[string]any{
		"member_id": "forged-neighbour",
		"answers":   []map[string]any{{"question_id": questionID, "value_text": "mine", "member_id": "forged-neighbour"}},
	}, cw.resident)
	if sent.Code != http.StatusOK {
		t.Fatalf("answer: %d %s", sent.Code, sent.Body.String())
	}
	mine := cw.call(t, "GET", path+"/mine", nil, cw.resident)
	if mine.Code != http.StatusOK {
		t.Fatalf("read own answers: %d %s", mine.Code, mine.Body.String())
	}
	all := cw.call(t, "GET", path, nil, cw.owner)
	if all.Code != http.StatusOK {
		t.Fatalf("staff reads all answers: %d %s", all.Code, all.Body.String())
	}
	if strings.Contains(all.Body.String(), "forged-neighbour") {
		t.Errorf("an answer was stored for the body's member: %s", all.Body.String())
	}
	if !strings.Contains(all.Body.String(), cw.actorID) {
		t.Errorf("the answer is not stored for the signed-in resident %s: %s", cw.actorID, all.Body.String())
	}
}
