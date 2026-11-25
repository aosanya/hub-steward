package http

import (
	"bytes"
	"encoding/json"
	"os"
	"slices"
	"testing"
)

type demoTemplate struct {
	demoPath   string
	publicPath string
	holder     string
	recordCode string
}

var convertedDemoTemplates = []demoTemplate{
	{
		demoPath:   "../../../../../demo/farmers/agency.json",
		publicPath: "../../../../console/public/templates/farmers.json",
		holder:     "Group coordinator",
		recordCode: "payments",
	},
	{
		demoPath:   "../../../../../demo/boda-boda-riders/agency.json",
		publicPath: "../../../../console/public/templates/boda-boda-riders.json",
		holder:     "Rider",
		recordCode: "paid_rides",
	},
}

var removedRecordRoleFields = []string{"role_id", "edit_role_id", "delete_role_id", "viewer_role_id"}

var removedTemplateKeys = []string{"role_assignments", "groups", "tags", "seats"}

type rawTemplate struct {
	Records []map[string]any `json:"records"`
	Roles   []map[string]any `json:"roles"`
}

func readTemplate(t *testing.T, path string) (rawTemplate, map[string]json.RawMessage, []byte) {
	t.Helper()
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	var doc rawTemplate
	if err := json.Unmarshal(raw, &doc); err != nil {
		t.Fatalf("decode %s: %v", path, err)
	}
	var keys map[string]json.RawMessage
	if err := json.Unmarshal(raw, &keys); err != nil {
		t.Fatalf("decode keys of %s: %v", path, err)
	}
	return doc, keys, raw
}

func permissionsCarriedBy(t *testing.T, doc rawTemplate, roleName string) []string {
	t.Helper()
	for _, role := range doc.Roles {
		if role["name"] != roleName {
			continue
		}
		list, _ := role["permissions"].([]any)
		carried := make([]string, 0, len(list))
		for _, item := range list {
			if code, ok := item.(string); ok {
				carried = append(carried, code)
			}
		}
		return carried
	}
	t.Fatalf("no role named %q", roleName)
	return nil
}

func TestDemoTemplatesCarryNoRecordRoleFieldAndNoRemovedKey(t *testing.T) {
	for _, tpl := range convertedDemoTemplates {
		for _, path := range []string{tpl.demoPath, tpl.publicPath} {
			doc, keys, _ := readTemplate(t, path)
			for _, key := range removedTemplateKeys {
				if _, found := keys[key]; found {
					t.Errorf("%s carries the key %q", path, key)
				}
			}
			if len(doc.Records) == 0 {
				t.Errorf("%s declares no record", path)
			}
			for _, record := range doc.Records {
				for _, field := range removedRecordRoleFields {
					if _, found := record[field]; found {
						t.Errorf("%s: record %v carries %q", path, record["code"], field)
					}
				}
			}
			for _, role := range doc.Roles {
				if _, found := role["powers"]; found {
					t.Errorf("%s: role %v carries powers", path, role["name"])
				}
			}
		}
	}
}

func TestDemoTemplateRecordsCarryReadableCodes(t *testing.T) {
	for _, tpl := range convertedDemoTemplates {
		doc, _, _ := readTemplate(t, tpl.demoPath)
		if len(doc.Records) != 1 || doc.Records[0]["code"] != tpl.recordCode {
			t.Errorf("%s: records %v, want the one record coded %q", tpl.demoPath, doc.Records, tpl.recordCode)
		}
	}
}

func TestTheHolderOfTheRecordCarriesItsPermissions(t *testing.T) {
	for _, tpl := range convertedDemoTemplates {
		doc, _, _ := readTemplate(t, tpl.demoPath)
		carried := permissionsCarriedBy(t, doc, tpl.holder)
		for _, action := range []string{".add.*", ".edit.*", ".view.*", ".delete"} {
			want := "record." + tpl.recordCode + action
			if !slices.Contains(carried, want) {
				t.Errorf("%s: %s does not carry %s", tpl.demoPath, tpl.holder, want)
			}
		}
	}
}

func TestNoOtherRoleOfTheDemoTemplatesCarriesARecordPermission(t *testing.T) {
	for _, tpl := range convertedDemoTemplates {
		doc, _, _ := readTemplate(t, tpl.demoPath)
		for _, role := range doc.Roles {
			name, _ := role["name"].(string)
			if name == tpl.holder {
				continue
			}
			for _, code := range permissionsCarriedBy(t, doc, name) {
				if len(code) > 7 && code[:7] == "record." {
					t.Errorf("%s: %s carries %s", tpl.demoPath, name, code)
				}
			}
		}
	}
}

func TestEachPublicTemplateEqualsItsDemoFile(t *testing.T) {
	for _, tpl := range convertedDemoTemplates {
		_, _, demo := readTemplate(t, tpl.demoPath)
		_, _, public := readTemplate(t, tpl.publicPath)
		if !bytes.Equal(demo, public) {
			t.Errorf("%s differs from %s", tpl.publicPath, tpl.demoPath)
		}
	}
}
