package http

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
	"wakalaserver/internal/formsettings"
)

func approvalSettingCall(h http.HandlerFunc, method, instanceID, caller, body string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, "/forms/approval-setting", strings.NewReader(body))
	r.SetPathValue("instanceID", instanceID)
	if caller != "" {
		r = r.WithContext(accounts.WithID(r.Context(), caller))
	}
	w := httptest.NewRecorder()
	h(w, r)
	return w
}

func approvalSettingWorld(t *testing.T) (applyWorld, *formsettings.Store) {
	t.Helper()
	w := newApplyWorld(t)
	store, err := formsettings.NewStore(stepRunDB(t))
	if err != nil {
		t.Fatalf("NewStore: %v", err)
	}
	return w, store
}

func TestOwnerReadsAndSetsWhetherFormsNeedApproval(t *testing.T) {
	w, store := approvalSettingWorld(t)
	read := readFormsApproval(w.reg, store)
	set := setFormsApproval(w.reg, store)

	first := approvalSettingCall(read, http.MethodGet, w.instanceID, "owner-1", "")
	if first.Code != http.StatusOK || !strings.Contains(first.Body.String(), `"approval_required":false`) {
		t.Fatalf("a new agency needs no approval: %d %s", first.Code, first.Body.String())
	}

	put := approvalSettingCall(set, http.MethodPut, w.instanceID, "owner-1", `{"approval_required":true}`)
	if put.Code != http.StatusOK {
		t.Fatalf("the owner sets the rule: %d %s", put.Code, put.Body.String())
	}
	var saved formsettings.Approval
	if err := json.Unmarshal(put.Body.Bytes(), &saved); err != nil || !saved.ApprovalRequired {
		t.Fatalf("the answer echoes the saved rule: %s (%v)", put.Body.String(), err)
	}

	again := approvalSettingCall(read, http.MethodGet, w.instanceID, "owner-1", "")
	if !strings.Contains(again.Body.String(), `"approval_required":true`) {
		t.Fatalf("the rule is kept: %s", again.Body.String())
	}
}

func TestOnlyTheOwnerMayTouchTheFormsApprovalSetting(t *testing.T) {
	w, store := approvalSettingWorld(t)
	if err := w.reg.AddMember(context.Background(), w.instanceID, "resident-1", agencies.RoleResident); err != nil {
		t.Fatalf("AddMember: %v", err)
	}
	read := readFormsApproval(w.reg, store)
	set := setFormsApproval(w.reg, store)

	for _, caller := range []string{"resident-1", "stranger", ""} {
		got := approvalSettingCall(read, http.MethodGet, w.instanceID, caller, "")
		if got.Code != http.StatusNotFound || !strings.Contains(got.Body.String(), "instance not found") {
			t.Errorf("caller %q reading: %d %s, want the same 404 an unknown agency gives", caller, got.Code, got.Body.String())
		}
		put := approvalSettingCall(set, http.MethodPut, w.instanceID, caller, `{"approval_required":true}`)
		if put.Code != http.StatusNotFound {
			t.Errorf("caller %q setting: %d, want 404", caller, put.Code)
		}
	}
	if kept, _ := store.Approval(context.Background(), w.instanceID); kept.ApprovalRequired {
		t.Fatal("a refused caller must not change the rule")
	}
}

func TestSettingTheFormsApprovalRuleRefusesAMalformedBody(t *testing.T) {
	w, store := approvalSettingWorld(t)
	got := approvalSettingCall(setFormsApproval(w.reg, store), http.MethodPut, w.instanceID, "owner-1", `{"approval_required":`)
	if got.Code != http.StatusBadRequest {
		t.Fatalf("a broken body is a 400, got %d %s", got.Code, got.Body.String())
	}
}

func TestFormsApprovalRoutesAreOnlyMountedWithARegistryAndAStore(t *testing.T) {
	w, store := approvalSettingWorld(t)

	for name, mount := range map[string]func(*http.ServeMux){
		"no registry": func(m *http.ServeMux) { registerFormsApprovalRoutes(m, nil, store, callers{}) },
		"no store":    func(m *http.ServeMux) { registerFormsApprovalRoutes(m, w.reg, nil, callers{}) },
	} {
		mux := http.NewServeMux()
		mount(mux)
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, strings.Replace(formsApprovalPath, "{instanceID}", w.instanceID, 1), nil))
		if rec.Code != http.StatusNotFound {
			t.Errorf("%s: nothing is mounted, got %d", name, rec.Code)
		}
	}
}
