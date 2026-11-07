package models

import "wakalaserver/modules/shared/geo"

type RaisedItem struct {
	ID            string        `json:"id"`
	Title         string        `json:"title"`
	Topic         string        `json:"topic"`
	Publishable   bool          `json:"publishable"`
	RaisedBy      string        `json:"raised_by"`
	FiledBy       string        `json:"filed_by"`
	Channel       string        `json:"channel"`
	Pin           *geo.Geometry `json:"pin"`
	Address       string        `json:"address"`
	Area          string        `json:"area"`
	AreaMismatch  string        `json:"area_mismatch"`
	Street        string        `json:"street"`
	Department    string        `json:"department"`
	DepartmentBy  string        `json:"department_by"`
	BoardItemID   string        `json:"board_item_id"`
	SubjectID     string        `json:"subject_id"`
	CreatedAt     string        `json:"created_at"`
	FollowKeyHash string        `json:"-"`
}

func (r RaisedItem) OnBehalfIsWhole() bool {
	return (r.FiledBy == "") == (r.Channel == "")
}

func (r RaisedItem) PinIsAPoint() bool {
	return r.Pin == nil || r.Pin.Kind == geo.KindPoint
}

func (r RaisedItem) AsSeenByOthers() RaisedItem {
	seen := r
	seen.Address = ""
	if r.Pin != nil {
		rounded := geo.NewPoint(geo.RoundForPublic(r.Pin.Point).Lon(), geo.RoundForPublic(r.Pin.Point).Lat())
		seen.Pin = &rounded
	}
	return seen
}

type FollowKey struct {
	RaisedItemID string `json:"raised_item_id"`
	Key          string `json:"key"`
}

type MyRaisedItem struct {
	RaisedItem
	Status string `json:"status"`
}

type FollowedRaisedItem struct {
	Item    RaisedItem `json:"item"`
	Status  string     `json:"status"`
	Replies []Reply    `json:"replies"`
}
