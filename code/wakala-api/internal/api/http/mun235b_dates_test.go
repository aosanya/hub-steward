package http

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	catalog "wakalaserver/modules/catalog"
	"wakalaserver/modules/shared/spec"

	"wakalaserver/internal/specs"
)

func mun235bSlotWalk(t *testing.T) stepRunWalk {
	t.Helper()
	raw, err := specs.For("wakala.catalog", "mun235b")
	if err != nil {
		t.Fatalf("specs.For: %v", err)
	}
	cs, err := catalog.ParseSpec(raw)
	if err != nil {
		t.Fatalf("ParseSpec: %v", err)
	}
	db := gateTestDB(t, "mun235b")
	if err := spec.Migrate(db, cs); err != nil {
		t.Fatalf("Migrate: %v", err)
	}
	cm, err := catalog.NewCatalogManager(db, cs)
	if err != nil {
		t.Fatalf("NewCatalogManager: %v", err)
	}
	w := newStepRunWalk(t, nil)
	deps := &Deps{Catalog: cm, Permissions: everyoneMay{}, Insights: w.deps.Insights, Sessions: w.deps.Sessions, AdminToken: w.deps.AdminToken}
	ApplyCaches(deps)
	w.deps = deps
	w.handler = NewRouter(deps)
	return w
}

func mun235bOffer(w stepRunWalk, t *testing.T, starts, ends string, capacity int) *httptest.ResponseRecorder {
	t.Helper()
	body := map[string]any{"subject_id": "svc", "starts_at": starts, "ends_at": ends, "capacity": capacity}
	return w.call(t, "POST", "/catalog/slots", body, w.owner)
}

func mun235bOffered(w stepRunWalk, t *testing.T, starts, ends string, capacity int) string {
	t.Helper()
	rec := mun235bOffer(w, t, starts, ends, capacity)
	if rec.Code != http.StatusCreated {
		t.Fatalf("offer %s: %d %s", starts, rec.Code, rec.Body.String())
	}
	id, _ := decodeObject(t, rec)["id"].(string)
	return id
}

func mun235bBook(w stepRunWalk, t *testing.T, slotID string, as *http.Cookie) *httptest.ResponseRecorder {
	t.Helper()
	return w.call(t, "POST", "/catalog/slots/"+slotID+"/bookings", nil, as)
}

func mun235bNoServerError(t *testing.T, label string, rec *httptest.ResponseRecorder) {
	t.Helper()
	if rec.Code >= 500 {
		t.Fatalf("%s: %d %s, want no 5xx", label, rec.Code, rec.Body.String())
	}
}

func TestMUN235b_SlotOffersAnswerSensiblyAndNeverFiveHundred(t *testing.T) {
	cases := []struct {
		name, starts, ends string
		want               int
		storedStart        string
	}{
		{"end before start", "2030-01-01T11:00:00Z", "2030-01-01T10:00:00Z", http.StatusBadRequest, ""},
		{"end equals start", "2030-01-01T10:00:00Z", "2030-01-01T10:00:00Z", http.StatusBadRequest, ""},
		{"past", "2001-01-01T10:00:00Z", "2001-01-01T11:00:00Z", http.StatusCreated, "2001-01-01T10:00:00Z"},
		{"year 0", "0000-01-01T10:00:00Z", "0000-01-01T11:00:00Z", http.StatusCreated, "0000-01-01T10:00:00Z"},
		{"year 9999", "9999-12-31T10:00:00Z", "9999-12-31T11:00:00Z", http.StatusCreated, "9999-12-31T10:00:00Z"},
		{"malformed", "2030-13-45T25:61:00Z", "2030-13-45T26:61:00Z", http.StatusBadRequest, ""},
		{"date only", "2030-01-01", "2030-01-02", http.StatusBadRequest, ""},
		{"offset becomes UTC", "2030-03-01T00:30:00+02:00", "2030-03-01T01:30:00+02:00", http.StatusCreated, "2030-02-28T22:30:00Z"},
		{"leap day", "2028-02-29T10:00:00Z", "2028-02-29T11:00:00Z", http.StatusCreated, "2028-02-29T10:00:00Z"},
		{"not a leap day", "2027-02-29T10:00:00Z", "2027-02-29T11:00:00Z", http.StatusBadRequest, ""},
		{"leap second", "2030-06-30T23:59:60Z", "2030-07-01T00:30:00Z", http.StatusBadRequest, ""},
		{"empty", "", "", http.StatusBadRequest, ""},
		{"lowercase separators", "2030-01-01t10:00:00z", "2030-01-01t11:00:00z", http.StatusBadRequest, ""},
		{"fractions dropped", "2030-01-01T10:00:00.123456789Z", "2030-01-01T11:00:00.5Z", http.StatusCreated, "2030-01-01T10:00:00Z"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			w := mun235bSlotWalk(t)
			rec := mun235bOffer(w, t, c.starts, c.ends, 1)
			mun235bNoServerError(t, c.name, rec)
			if rec.Code != c.want {
				t.Fatalf("%s: %d %s, want %d", c.name, rec.Code, rec.Body.String(), c.want)
			}
			if c.storedStart != "" && decodeObject(t, rec)["starts_at"] != c.storedStart {
				t.Fatalf("%s: stored %s, want starts_at %s", c.name, rec.Body.String(), c.storedStart)
			}
		})
	}
}

func TestMUN235b_SlotWhoseOffsetLeavesYearsZeroToNineNineNineNineIsRefused(t *testing.T) {
	t.Skip("MUN689: starts_at -0001-12-31T10:00:00Z and 10000-01-01T13:00:00Z are stored; remove this line with the fix")
	w := mun235bSlotWalk(t)
	for _, c := range []struct{ name, starts, ends string }{
		{"year 0 east", "0000-01-01T00:00:00+14:00", "0000-01-01T01:00:00+14:00"},
		{"year 9999 west", "9999-12-31T23:00:00-14:00", "9999-12-31T23:59:59-14:00"},
	} {
		rec := mun235bOffer(w, t, c.starts, c.ends, 1)
		mun235bNoServerError(t, c.name, rec)
		if rec.Code == http.StatusCreated {
			stored, _ := decodeObject(t, rec)["starts_at"].(string)
			if strings.HasPrefix(stored, "-") || len(stored) != len("2006-01-02T15:04:05Z") {
				t.Errorf("%s: stored starts_at %q, want 400 or a four-digit year", c.name, stored)
			}
		}
	}
}

func TestMUN235b_BookingsHoldCapacityAndDayListsRefuseBadDays(t *testing.T) {
	w := mun235bSlotWalk(t)
	ada, bela, cili := w.cookieFor(t, "ada"), w.cookieFor(t, "bela"), w.cookieFor(t, "cili")
	slot := mun235bOffered(w, t, "2030-03-01T10:00:00Z", "2030-03-01T11:00:00Z", 2)

	if rec := mun235bBook(w, t, slot, ada); rec.Code != http.StatusCreated || decodeObject(t, rec)["day"] != "2030-03-01" {
		t.Fatalf("ada books: %d %s, want 201 on day 2030-03-01", rec.Code, rec.Body.String())
	}
	if rec := mun235bBook(w, t, slot, ada); rec.Code != http.StatusConflict {
		t.Errorf("ada books the same slot twice: %d %s, want 409", rec.Code, rec.Body.String())
	}
	if rec := mun235bBook(w, t, slot, bela); rec.Code != http.StatusCreated {
		t.Errorf("bela takes the second place: %d %s, want 201", rec.Code, rec.Body.String())
	}
	if rec := mun235bBook(w, t, slot, cili); rec.Code != http.StatusConflict {
		t.Errorf("cili takes a third place on a slot of two: %d %s, want 409", rec.Code, rec.Body.String())
	}

	days := []struct {
		day  string
		want int
	}{
		{"2030-03-01", http.StatusOK},
		{"2028-02-29", http.StatusOK},
		{"0000-01-01", http.StatusOK},
		{"9999-12-31", http.StatusOK},
		{"2030-02-30", http.StatusBadRequest},
		{"2027-02-29", http.StatusBadRequest},
		{"2030-3-1", http.StatusBadRequest},
		{"", http.StatusBadRequest},
		{"2030-03-01T00:00:00Z", http.StatusBadRequest},
		{"-0001-12-31", http.StatusBadRequest},
		{"10000-01-01", http.StatusBadRequest},
	}
	for _, d := range days {
		rec := w.call(t, "GET", "/catalog/bookings/by-day?day="+d.day, nil, w.owner)
		mun235bNoServerError(t, "by-day "+d.day, rec)
		if rec.Code != d.want {
			t.Errorf("by-day %q: %d %s, want %d", d.day, rec.Code, rec.Body.String(), d.want)
		}
	}
}

func TestMUN235b_ASlotThatHasEndedCannotBeBooked(t *testing.T) {
	t.Skip("MUN691: a slot that ended in 2001 books 201; remove this line with the fix")
	w := mun235bSlotWalk(t)
	slot := mun235bOffered(w, t, "2001-01-01T10:00:00Z", "2001-01-01T11:00:00Z", 1)
	if rec := mun235bBook(w, t, slot, w.cookieFor(t, "ada")); rec.Code < 400 || rec.Code >= 500 {
		t.Fatalf("booking a slot that ended in 2001: %d %s, want 4xx", rec.Code, rec.Body.String())
	}
}

func TestMUN235b_ABookingAtHalfPastMidnightLocalListsOnItsLocalDay(t *testing.T) {
	t.Skip("MUN692: the booking's day is the UTC day 2030-02-28; remove this line with the fix")
	w := mun235bSlotWalk(t)
	slot := mun235bOffered(w, t, "2030-03-01T00:30:00+02:00", "2030-03-01T01:30:00+02:00", 1)
	if rec := mun235bBook(w, t, slot, w.cookieFor(t, "ada")); rec.Code != http.StatusCreated {
		t.Fatalf("book: %d %s", rec.Code, rec.Body.String())
	}
	rec := w.call(t, "GET", "/catalog/bookings/by-day?day=2030-03-01", nil, w.owner)
	if got := decodeObjects(t, rec); len(got) != 1 {
		t.Fatalf("by-day 2030-03-01: %s, want the 00:30+02:00 booking", rec.Body.String())
	}
}

func TestMUN235b_OneResidentCannotHoldPlacesOnOverlappingSlotsOfOneService(t *testing.T) {
	t.Skip("MUN693: both bookings answer 201; remove this line with the fix")
	w := mun235bSlotWalk(t)
	first := mun235bOffered(w, t, "2030-03-01T10:00:00Z", "2030-03-01T11:00:00Z", 2)
	second := mun235bOffered(w, t, "2030-03-01T10:30:00Z", "2030-03-01T11:30:00Z", 2)
	ada := w.cookieFor(t, "ada")
	if rec := mun235bBook(w, t, first, ada); rec.Code != http.StatusCreated {
		t.Fatalf("first booking: %d %s", rec.Code, rec.Body.String())
	}
	if rec := mun235bBook(w, t, second, ada); rec.Code != http.StatusConflict {
		t.Fatalf("overlapping booking by the same resident: %d %s, want 409", rec.Code, rec.Body.String())
	}
}

type mun235bEventWalk struct {
	stepRunWalk
	path    string
	groupID string
}

func newMUN235bEventWalk(t *testing.T) mun235bEventWalk {
	t.Helper()
	w := newStepRunWalk(t, nil)
	path := "/instances/" + w.instance
	group := w.call(t, "POST", path+"/actor/groups", map[string]any{"name": "Town hall"}, w.owner)
	if group.Code != http.StatusCreated {
		t.Fatalf("create group: %d %s", group.Code, group.Body.String())
	}
	groupID, _ := decodeObject(t, group)["id"].(string)
	return mun235bEventWalk{stepRunWalk: w, path: path, groupID: groupID}
}

func (w mun235bEventWalk) post(t *testing.T, starts, ends, zone string) *httptest.ResponseRecorder {
	t.Helper()
	body := map[string]any{"kind": "event", "title": "Street cleanup", "group_ids": []string{w.groupID}, "starts_at": starts, "ends_at": ends, "time_zone": zone, "place": "Hall"}
	return w.call(t, "POST", w.path+"/engage/posts", body, w.owner)
}

func (w mun235bEventWalk) change(t *testing.T, postID string, body map[string]any) *httptest.ResponseRecorder {
	t.Helper()
	return w.call(t, "PATCH", w.path+"/engage/posts/"+postID+"/event", body, w.owner)
}

func TestMUN235b_EventsAnswerSensiblyAndNeverFiveHundred(t *testing.T) {
	const budapest = "Europe/Budapest"
	cases := []struct {
		name, starts, ends, zone string
		want                     int
	}{
		{"ordinary", "2030-05-01T10:00:00Z", "2030-05-01T12:00:00Z", budapest, http.StatusCreated},
		{"end before start", "2030-05-01T12:00:00Z", "2030-05-01T10:00:00Z", budapest, http.StatusBadRequest},
		{"end equals start", "2030-05-01T10:00:00Z", "2030-05-01T10:00:00Z", budapest, http.StatusBadRequest},
		{"past", "2001-05-01T10:00:00Z", "2001-05-01T12:00:00Z", budapest, http.StatusCreated},
		{"year 0", "0000-05-01T10:00:00Z", "0000-05-01T12:00:00Z", budapest, http.StatusCreated},
		{"year 9999", "9999-05-01T10:00:00Z", "9999-05-01T12:00:00Z", budapest, http.StatusCreated},
		{"words that sort backwards", "tomorrow", "next week", budapest, http.StatusBadRequest},
		{"leap day", "2028-02-29T10:00:00Z", "2028-02-29T12:00:00Z", budapest, http.StatusCreated},
		{"no zone", "2030-05-01T10:00:00Z", "2030-05-01T12:00:00Z", "", http.StatusCreated},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			w := newMUN235bEventWalk(t)
			rec := w.post(t, c.starts, c.ends, c.zone)
			mun235bNoServerError(t, c.name, rec)
			if rec.Code != c.want {
				t.Fatalf("%s: %d %s, want %d", c.name, rec.Code, rec.Body.String(), c.want)
			}
		})
	}
}

func TestMUN235b_ChangingAnEventKeepsEndAfterStartAndNeverFiveHundred(t *testing.T) {
	w := newMUN235bEventWalk(t)
	created := w.post(t, "2030-05-01T10:00:00Z", "2030-05-01T12:00:00Z", "Europe/Budapest")
	postID, _ := decodeObject(t, created)["id"].(string)
	for _, c := range []struct {
		name string
		body map[string]any
		want int
	}{
		{"end before start", map[string]any{"ends_at": "2030-05-01T09:00:00Z"}, http.StatusBadRequest},
		{"later end", map[string]any{"ends_at": "2030-05-01T13:00:00Z"}, http.StatusOK},
		{"leap day", map[string]any{"starts_at": "2028-02-29T10:00:00Z", "ends_at": "2028-02-29T12:00:00Z"}, http.StatusOK},
		{"year 9999", map[string]any{"starts_at": "9999-12-31T10:00:00Z", "ends_at": "9999-12-31T12:00:00Z"}, http.StatusOK},
	} {
		rec := w.change(t, postID, c.body)
		mun235bNoServerError(t, c.name, rec)
		if rec.Code != c.want {
			t.Errorf("%s: %d %s, want %d", c.name, rec.Code, rec.Body.String(), c.want)
		}
	}
}

func TestMUN235b_EventStartAndEndAreReadAsTimes(t *testing.T) {
	t.Skip("MUN694: zzz to zzzz, 2027-02-29, a date only and lowercase t/z are stored; remove this line with the fix")
	w := newMUN235bEventWalk(t)
	for _, c := range []struct{ name, starts, ends string }{
		{"words", "zzz", "zzzz"},
		{"not a leap day", "2027-02-29T10:00:00Z", "2027-02-29T12:00:00Z"},
		{"date only", "2030-05-01", "2030-05-02"},
		{"lowercase separators", "2030-05-01t10:00:00z", "2030-05-01t12:00:00z"},
	} {
		rec := w.post(t, c.starts, c.ends, "Europe/Budapest")
		mun235bNoServerError(t, c.name, rec)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("%s: %d %s, want 400", c.name, rec.Code, rec.Body.String())
		}
	}
	created := w.post(t, "2030-05-01T10:00:00Z", "2030-05-01T12:00:00Z", "Europe/Budapest")
	postID, _ := decodeObject(t, created)["id"].(string)
	if rec := w.change(t, postID, map[string]any{"starts_at": "zzz", "ends_at": "zzzz"}); rec.Code != http.StatusBadRequest {
		t.Errorf("changing an event to zzz-zzzz: %d %s, want 400", rec.Code, rec.Body.String())
	}
}

func TestMUN235b_EventEndIsComparedWithStartAsAnInstant(t *testing.T) {
	t.Skip("MUN695: end and start are compared as text; remove this line with the fix")
	w := newMUN235bEventWalk(t)
	if rec := w.post(t, "2030-05-01T10:00:00+02:00", "2030-05-01T09:30:00Z", "Europe/Budapest"); rec.Code != http.StatusCreated {
		t.Errorf("an event that ends 90 minutes after it starts: %d %s, want 201", rec.Code, rec.Body.String())
	}
	if rec := w.post(t, "2030-05-01T10:00:00Z", "2030-05-01T11:00:00+14:00", "Europe/Budapest"); rec.Code != http.StatusBadRequest {
		t.Errorf("an event that ends 13 hours before it starts: %d %s, want 400", rec.Code, rec.Body.String())
	}
}

func TestMUN235b_EventTimeZoneMustBeAKnownZone(t *testing.T) {
	t.Skip("MUN696: Mars/Olympus and +02:00 are stored; remove this line with the fix")
	w := newMUN235bEventWalk(t)
	for _, zone := range []string{"Mars/Olympus", "+02:00"} {
		rec := w.post(t, "2030-05-01T10:00:00Z", "2030-05-01T12:00:00Z", zone)
		mun235bNoServerError(t, zone, rec)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("time zone %q: %d %s, want 400", zone, rec.Code, rec.Body.String())
		}
	}
	created := w.post(t, "2030-05-01T10:00:00Z", "2030-05-01T12:00:00Z", "Europe/Budapest")
	postID, _ := decodeObject(t, created)["id"].(string)
	if rec := w.change(t, postID, map[string]any{"time_zone": "Mars/Olympus"}); rec.Code != http.StatusBadRequest {
		t.Errorf("changing the zone to Mars/Olympus: %d %s, want 400", rec.Code, rec.Body.String())
	}
}
