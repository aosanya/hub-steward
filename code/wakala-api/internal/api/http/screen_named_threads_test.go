package http

import (
	"encoding/json"
	"testing"
)

func TestTheThreadListNamesWhoAskedAndWhoWroteLast(t *testing.T) {
	fields := screenNamedLists["comm.chat_thread.list"]
	if len(fields) != 2 {
		t.Fatalf("thread list names %d fields, want 2 (the asker and the last author)", len(fields))
	}
	row := map[string]json.RawMessage{
		"requested_by": json.RawMessage(`"a-1"`),
		"last_message": json.RawMessage(`{"author_id":"a-2"}`),
	}
	rows := []map[string]json.RawMessage{row}
	names := map[string]string{"a-1": "Sipos Hanna", "a-2": "Farkas Zoltán"}
	for _, field := range fields {
		rows = field.withNames(rows, names)
	}
	var asker string
	_ = json.Unmarshal(rows[0]["requested_by_name"], &asker)
	if asker != "Sipos Hanna" {
		t.Fatalf("requested_by_name = %q, want the asker's name", asker)
	}
	var last map[string]string
	_ = json.Unmarshal(rows[0]["last_message"], &last)
	if last["author_name"] != "Farkas Zoltán" {
		t.Fatalf("last_message.author_name = %q, want the last author's name", last["author_name"])
	}
}
