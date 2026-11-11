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

type FollowedItemView struct {
	ID          string        `json:"id"`
	Title       string        `json:"title"`
	Topic       string        `json:"topic"`
	Publishable bool          `json:"publishable"`
	Pin         *geo.Geometry `json:"pin"`
	Address     string        `json:"address"`
	Area        string        `json:"area"`
	Street      string        `json:"street"`
	Department  string        `json:"department"`
	CreatedAt   string        `json:"created_at"`
}

type FollowedReplyView struct {
	ID           string `json:"id"`
	RaisedItemID string `json:"raised_item_id"`
	Body         string `json:"body"`
	CreatedAt    string `json:"created_at"`
}

type FollowedRaisedItemView struct {
	Item    FollowedItemView    `json:"item"`
	Status  string              `json:"status"`
	Replies []FollowedReplyView `json:"replies"`
}

func (f FollowedRaisedItem) FollowerView() FollowedRaisedItemView {
	i := f.Item
	view := FollowedRaisedItemView{
		Item: FollowedItemView{
			ID: i.ID, Title: i.Title, Topic: i.Topic, Publishable: i.Publishable, Pin: i.Pin, Address: i.Address,
			Area: i.Area, Street: i.Street, Department: i.Department, CreatedAt: i.CreatedAt,
		},
		Status:  f.Status,
		Replies: make([]FollowedReplyView, len(f.Replies)),
	}
	for n, r := range f.Replies {
		view.Replies[n] = FollowedReplyView{ID: r.ID, RaisedItemID: r.RaisedItemID, Body: r.Body, CreatedAt: r.CreatedAt}
	}
	return view
}
