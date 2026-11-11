package http

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sort"
	"strings"
	"testing"

	accounting "wakalaserver/modules/accounting"
	ai "wakalaserver/modules/ai"
	assetmanager "wakalaserver/modules/assetmanager"
	catalog "wakalaserver/modules/catalog"
	comm "wakalaserver/modules/comm"
	forms "wakalaserver/modules/forms"
	"wakalaserver/modules/shared/dispatch"
	sources "wakalaserver/modules/sources"
)

func sweptReads(t *testing.T, w *sweepWorld) []declaredOperation {
	t.Helper()
	out := append([]declaredOperation{}, (&operationCatalog{}).get(w.walk.deps)...)
	extra := []mountedModule{
		{module: "forms", prefix: formsInstancePrefix, operations: forms.Operations()},
		{module: "comm", prefix: commInstancePrefix, operations: comm.Operations()},
		{module: "forms-catalog", prefix: formsCatalogInstancePrefix, operations: catalog.Operations()},
		{module: "ai", prefix: aiInstancePrefix, operations: ai.Operations()},
		{module: "accounting", prefix: accountingInstancePrefix, operations: accounting.Operations()},
		{module: "sources", prefix: sourcesInstancePrefix, operations: sources.Operations()},
		{module: "assetmanager", prefix: assetManagerInstancePrefix, operations: assetmanager.Operations()},
	}
	for _, mount := range extra {
		s, err := dispatch.Parse(mount.operations)
		if err != nil {
			t.Fatalf("parse %s: %v", mount.module, err)
		}
		for _, op := range s.Operations {
			if op.Action == "" {
				continue
			}
			out = append(out, declaredOperation{Module: mount.module, Action: op.Action, Method: op.Method, Path: mount.prefix + s.Base + op.Path})
		}
	}
	var reads []declaredOperation
	for _, op := range out {
		if op.Method == http.MethodGet {
			reads = append(reads, op)
		}
	}
	sort.Slice(reads, func(i, j int) bool { return reads[i].Path < reads[j].Path })
	return reads
}

func (w *sweepWorld) pathFor(op declaredOperation) string {
	path := strings.ReplaceAll(op.Path, "{instanceID}", w.walk.instance)
	path = pathParameter.ReplaceAllStringFunc(path, func(token string) string {
		name := strings.Trim(token, "{}")
		if own, ok := w.byAction[op.Action][name]; ok {
			return own
		}
		if value, ok := w.params[name]; ok {
			return value
		}
		return "x"
	})
	if query := w.queries[op.Action]; query != "" {
		path += "?" + query
	}
	return path
}

type staffIDHit struct {
	where string
	field string
}

func staffIDsIn(value any, staff map[string]string, trail string, hits *[]staffIDHit) {
	switch v := value.(type) {
	case map[string]any:
		for key, inner := range v {
			staffIDsIn(inner, staff, trail+"."+key, hits)
		}
	case []any:
		for _, inner := range v {
			staffIDsIn(inner, staff, trail+"[]", hits)
		}
	case string:
		if _, isStaff := staff[v]; isStaff {
			*hits = append(*hits, staffIDHit{where: trail, field: v})
		}
	}
}

type sweepOutcome struct {
	op     declaredOperation
	path   string
	status int
	hits   []staffIDHit
	body   string
}

func sweep(t *testing.T, w *sweepWorld, as *http.Cookie) []sweepOutcome {
	t.Helper()
	staff := map[string]string{ownerAccount: "owner", w.clerkID: "clerk"}
	var out []sweepOutcome
	for _, op := range sweptReads(t, w) {
		path := w.pathFor(op)
		var rec *httptest.ResponseRecorder
		if as == nil {
			req := httptest.NewRequest(http.MethodGet, path, nil)
			rec = httptest.NewRecorder()
			w.walk.handler.ServeHTTP(rec, req)
		} else {
			rec = w.walk.call(t, http.MethodGet, path, nil, as)
		}
		outcome := sweepOutcome{op: op, path: path, status: rec.Code, body: rec.Body.String()}
		if rec.Code == http.StatusOK {
			var decoded any
			if json.Unmarshal(rec.Body.Bytes(), &decoded) == nil {
				staffIDsIn(decoded, staff, "", &outcome.hits)
			}
		}
		out = append(out, outcome)
	}
	return out
}

var staffIDsMeantToShow = map[string]string{
	"comm.chat_message.list": "[].author_id",
}

func leaksOf(outcomes []sweepOutcome) []string {
	var leaks []string
	for _, o := range outcomes {
		for _, hit := range o.hits {
			if staffIDsMeantToShow[o.op.Action] == hit.where {
				continue
			}
			leaks = append(leaks, o.op.Action+" "+hit.where+" ("+o.path+")")
		}
	}
	sort.Strings(leaks)
	return leaks
}

func reached(outcomes []sweepOutcome, action string) bool {
	for _, o := range outcomes {
		if o.op.Action == action && o.status == http.StatusOK {
			return true
		}
	}
	return false
}

func TestResidentSweep_NoReadAResidentOrAStrangerReachesReturnsAStaffMemberId(t *testing.T) {
	w := newSweepWorld(t)
	for _, who := range []struct {
		name string
		as   *http.Cookie
		need []string
	}{
		{"resident", w.resident, []string{
			"actor.invitation.list_mine", "actor.join_decision.read_mine", "actor.join_request.list_mine",
			"comm.chat_message.list", "comm.subject_message.list", "custody.consent_version.in_force",
			"forms.submission.read_mine", "forms.results.read", "forms.form.read", "forms.form.list_waiting",
			"market.poster.list", "voting.poll.read", "voting.result.read",
		}},
		{"neighbour", w.neighbour, []string{"actor.group.find_by_code", "actor.join_request.list_mine"}},
		{"stranger", nil, []string{"forms.public_link.open", "catalog.raised_item.open_followed", "catalog.board_item.open_shared"}},
	} {
		outcomes := sweep(t, w, who.as)
		for _, action := range who.need {
			if !reached(outcomes, action) {
				t.Errorf("%s: the sweep no longer reaches %s, so it proves nothing about it", who.name, action)
			}
		}
		for _, leak := range leaksOf(outcomes) {
			t.Errorf("%s reads a staff member id: %s", who.name, leak)
		}
	}
}

func TestResidentSweep_TheChatAuthorOfAStaffReplyStaysBecauseAPostShowsItsAuthor(t *testing.T) {
	w := newSweepWorld(t)
	var shown bool
	for _, o := range sweep(t, w, w.resident) {
		if o.op.Action != "comm.chat_message.list" {
			continue
		}
		for _, hit := range o.hits {
			shown = shown || hit.where == staffIDsMeantToShow[o.op.Action]
		}
	}
	if !shown {
		t.Fatalf("a chat post no longer shows the staff member who wrote it")
	}
}

func (w *sweepWorld) get(t *testing.T, path string, as *http.Cookie) *httptest.ResponseRecorder {
	t.Helper()
	rec := w.walk.call(t, http.MethodGet, path, nil, as)
	if rec.Code != http.StatusOK {
		t.Fatalf("GET %s: %d %s", path, rec.Code, rec.Body.String())
	}
	return rec
}

func TestResidentSweep_TrimmedReadsKeepWhatTheResidentNeedsAndStaffKeepTheirIds(t *testing.T) {
	w := newSweepWorld(t)
	instance := "/instances/" + w.walk.instance
	owner := w.walk.owner
	require := func(where string, row map[string]any, fields ...string) {
		t.Helper()
		for _, field := range fields {
			if value, held := row[field]; !held || value == "" {
				t.Errorf("%s no longer holds %s: %v", where, field, row)
			}
		}
	}

	invitation := decodeObjects(t, w.get(t, instance+"/actor/invitations/mine", w.resident))[0]
	require("resident's invitation", invitation, "id", "group_id", "state", "invited_at", "expires_at")
	if staff := decodeObjects(t, w.get(t, instance+"/actor/groups/"+w.params["invited_group"]+"/invitations", owner))[0]; staff["invited_by"] != ownerAccount {
		t.Errorf("staff read of the group's invitations lost invited_by: %v", staff)
	}

	request := decodeObjects(t, w.get(t, instance+"/actor/join-requests/mine", w.neighbour))[0]
	require("neighbour's join request", request, "id", "group_id", "state", "message", "decline_reason", "decided_at")
	if staff := decodeObjects(t, w.get(t, instance+"/actor/groups/"+w.probe.otherWard+"/join-requests", owner)); len(staff) == 0 || staff[0]["decided_by"] == nil {
		t.Errorf("staff read of the group's join requests lost decided_by: %v", staff)
	}

	decision := decodeObject(t, w.get(t, instance+"/actor/join-decisions/"+w.params["decision_id"], w.resident))
	require("resident's join decision", decision, "id", "request_id", "group_id", "state", "decided_at")

	sheet := decodeObject(t, w.get(t, instance+"/custody/consent/versions/in-force/mechanics/en", w.resident))
	require("the consent sheet in force", sheet, "id", "scope", "version", "language", "published_at")
	if staff := decodeObject(t, w.get(t, instance+"/custody/consent/versions/"+w.params["versionID"], owner)); staff["published_by"] != ownerAccount {
		t.Errorf("staff read of the consent version lost published_by: %v", staff)
	}

	submission := decodeObject(t, w.get(t, instance+"/forms/forms/"+w.params["form_id"]+"/submissions/mine", w.resident))
	require("resident's submission", submission, "id", "form_id", "member_id", "submitted_at", "paid_at")
	if submission["paid"] != true {
		t.Errorf("resident's submission no longer says it was paid: %v", submission)
	}
	if staff := decodeObjects(t, w.get(t, instance+"/forms/forms/"+w.params["form_id"]+"/submissions", owner)); len(staff) == 0 || staff[0]["paid_by"] != ownerAccount {
		t.Errorf("staff read of the submissions lost paid_by: %v", staff)
	}

	posters := decodeObjects(t, w.get(t, instance+"/market/posters", w.resident))
	if len(posters) == 0 {
		t.Fatalf("resident sees no poster")
	}
	require("resident's poster", posters[0], "id", "name", "status", "owner_name")
	if staff := decodeObjects(t, w.get(t, instance+"/market/posters", owner)); len(staff) == 0 || staff[0]["approved_by"] != ownerAccount {
		t.Errorf("staff read of the posters lost approved_by: %v", staff)
	}
}
