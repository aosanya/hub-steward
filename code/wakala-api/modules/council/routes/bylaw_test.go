package routes

import (
	"encoding/json"
	"strings"
	"testing"

	council "wakalaserver/modules/council"
)

type bylawRow struct {
	ID         string `json:"id"`
	InstanceID string `json:"instance_id"`
	Title      string `json:"title"`
	Year       int64  `json:"year"`
	Text       string `json:"text"`
	CreatedAt  string `json:"created_at"`
}

func newBylaw(t *testing.T, cm council.CouncilManager, agency, title string, year int, text string) bylawRow {
	t.Helper()
	args, err := json.Marshal(map[string]any{"instance_id": agency, "title": title, "year": year, "text": text})
	if err != nil {
		t.Fatal(err)
	}
	out, err := call(t, tool(t, cm, "council_bylaw_create"), string(args))
	if err != nil {
		t.Fatal(err)
	}
	var made bylawRow
	if err := json.Unmarshal(out, &made); err != nil || made.ID == "" {
		t.Fatalf("bylaw = %s, %v", out, err)
	}
	return made
}

func listBylaws(t *testing.T, cm council.CouncilManager, args string) []bylawRow {
	t.Helper()
	out, err := call(t, tool(t, cm, "council_bylaw_list"), args)
	if err != nil {
		t.Fatal(err)
	}
	var rows []bylawRow
	if err := json.Unmarshal(out, &rows); err != nil {
		t.Fatalf("%s: %v", out, err)
	}
	return rows
}

func TestTheBylawOperationsBecomeThreeTools(t *testing.T) {
	want := map[string]string{
		"council_bylaw_create": "council.bylaw.create",
		"council_bylaw_list":   "council.bylaw.list",
		"council_bylaw_read":   "council.bylaw.read",
	}
	byName := map[string]string{}
	for _, tl := range Tools(newManager(t)) {
		byName[tl.Name] = tl.Action
	}
	for name, action := range want {
		if byName[name] != action {
			t.Errorf("%s has action %q, want %q", name, byName[name], action)
		}
	}
}

func TestABylawCreatedWithTitleYearAndTextIsReadBack(t *testing.T) {
	cm := newManager(t)
	made := newBylaw(t, cm, "town-1", "  Market trading hours ", 2024, "Stalls open at 7.")
	if made.Title != "Market trading hours" || made.Year != 2024 || made.CreatedAt == "" {
		t.Fatalf("created = %+v", made)
	}

	read, err := call(t, tool(t, cm, "council_bylaw_read"), `{"instance_id":"town-1","bylawID":"`+made.ID+`"}`)
	if err != nil {
		t.Fatal(err)
	}
	var got bylawRow
	if err := json.Unmarshal(read, &got); err != nil {
		t.Fatalf("%s: %v", read, err)
	}
	if got.ID != made.ID || got.Title != "Market trading hours" || got.Year != 2024 || got.Text != "Stalls open at 7." {
		t.Fatalf("read = %+v", got)
	}
}

func TestABylawNeedsATitleAndAFourDigitYear(t *testing.T) {
	cm := newManager(t)
	create := tool(t, cm, "council_bylaw_create")
	for name, args := range map[string]string{
		"no title":      `{"instance_id":"town-1","year":2024}`,
		"blank title":   `{"instance_id":"town-1","title":"   ","year":2024}`,
		"no year":       `{"instance_id":"town-1","title":"Noise"}`,
		"year too low":  `{"instance_id":"town-1","title":"Noise","year":24}`,
		"year too high": `{"instance_id":"town-1","title":"Noise","year":20240}`,
		"no agency":     `{"title":"Noise","year":2024}`,
	} {
		if _, err := call(t, create, args); err == nil {
			t.Errorf("%s: want a refusal", name)
		}
	}
	if rows := listBylaws(t, cm, `{"instance_id":"town-1"}`); len(rows) != 0 {
		t.Fatalf("refused bylaws were stored: %+v", rows)
	}
}

func TestBylawsListEarliestYearFirstAndNarrowToOneYear(t *testing.T) {
	cm := newManager(t)
	newBylaw(t, cm, "town-1", "Dogs", 2022, "")
	newBylaw(t, cm, "town-1", "Bins", 1998, "")
	newBylaw(t, cm, "town-1", "Allotments", 2022, "")

	var titles []string
	for _, b := range listBylaws(t, cm, `{"instance_id":"town-1"}`) {
		titles = append(titles, b.Title)
	}
	if strings.Join(titles, "|") != "Bins|Allotments|Dogs" {
		t.Fatalf("order = %v", titles)
	}

	only := listBylaws(t, cm, `{"instance_id":"town-1","year":2022}`)
	if len(only) != 2 || only[0].Title != "Allotments" || only[1].Title != "Dogs" {
		t.Fatalf("2022 = %+v", only)
	}
}

func TestOneAgencyNeverReadsAnotherAgencysBylaws(t *testing.T) {
	cm := newManager(t)
	mine := newBylaw(t, cm, "town-1", "Market trading hours", 2024, "text")
	newBylaw(t, cm, "town-2", "Harbour dues", 2020, "text")

	if rows := listBylaws(t, cm, `{"instance_id":"town-1"}`); len(rows) != 1 || rows[0].ID != mine.ID {
		t.Fatalf("town-1 list = %+v", rows)
	}
	if _, err := call(t, tool(t, cm, "council_bylaw_read"), `{"instance_id":"town-2","bylawID":"`+mine.ID+`"}`); err == nil {
		t.Fatal("another agency read this bylaw")
	}
}

func TestReadingAnUnknownBylawIsRefused(t *testing.T) {
	cm := newManager(t)
	if _, err := call(t, tool(t, cm, "council_bylaw_read"), `{"instance_id":"town-1","bylawID":"nope"}`); err == nil {
		t.Fatal("want not found")
	}
}
