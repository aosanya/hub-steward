package notifyrules

import (
	"errors"
	"slices"
)

type Event string

const (
	JoinAsked           Event = "join_asked"
	JoinApproved        Event = "join_approved"
	JoinDeclined        Event = "join_declined"
	ThreadStarted       Event = "thread_started"
	ThreadDeclined      Event = "thread_declined"
	ThreadReply         Event = "thread_reply"
	FormSent            Event = "form_sent"
	FormPrivateChat     Event = "form_private_chat"
	Invited             Event = "invited"
	SupplierApproved    Event = "supplier_approved"
	AskAnswered         Event = "ask_answered"
	AskWaiting          Event = "ask_waiting"
	RevisionAsked       Event = "revision_asked"
	NoticePosted        Event = "notice_posted"
	QuoteSent           Event = "quote_sent"
	DraftWaiting        Event = "draft_waiting"
	CounterSent         Event = "counter_sent"
	AskClosed           Event = "ask_closed"
	GroupOrderCalledOff Event = "group_order_called_off"
)

type Audience string

const (
	Subject      Audience = "subject"
	GroupLeaders Audience = "group_leaders"
	Owners       Audience = "owners"
	Agents       Audience = "agents"
	Group        Audience = "group"
	Thread       Audience = "thread"
)

type Rule struct {
	Event     Event      `json:"event"`
	Told      []Audience `json:"told"`
	Fallback  []Audience `json:"fallback"`
	Mutable   bool       `json:"mutable"`
	FixedMute bool       `json:"fixed_mute"`
}

var (
	ErrUnknownEvent    = errors.New("unknown notification event")
	ErrAudienceRefused = errors.New("this event cannot tell that audience")
	ErrMuteFixed       = errors.New("whether this event can be muted is fixed")
)

var Events = []Event{JoinAsked, JoinApproved, JoinDeclined, ThreadStarted, ThreadDeclined, ThreadReply, FormSent, FormPrivateChat, Invited, SupplierApproved, AskAnswered, AskWaiting, RevisionAsked, NoticePosted, QuoteSent, DraftWaiting, CounterSent, AskClosed, GroupOrderCalledOff}

var allowed = map[Event][]Audience{
	JoinAsked:           {Subject, GroupLeaders, Owners, Agents},
	JoinApproved:        {Subject, GroupLeaders, Owners, Agents, Group},
	JoinDeclined:        {Subject, GroupLeaders, Owners, Agents},
	ThreadStarted:       {Subject, GroupLeaders, Owners, Agents, Group},
	ThreadDeclined:      {Subject, GroupLeaders, Owners, Agents},
	ThreadReply:         {Subject, GroupLeaders, Owners, Agents, Thread},
	FormSent:            {GroupLeaders, Owners, Agents, Group},
	FormPrivateChat:     {Subject, GroupLeaders, Owners, Agents},
	Invited:             {Subject, GroupLeaders, Owners, Agents},
	SupplierApproved:    {Subject, Owners, Agents},
	AskAnswered:         {Subject, Owners, Agents},
	AskWaiting:          {Subject, Owners, Agents},
	RevisionAsked:       {Subject, Owners, Agents},
	NoticePosted:        {Subject, Owners, Agents},
	QuoteSent:           {Subject, Owners, Agents},
	DraftWaiting:        {Subject, Owners, Agents},
	CounterSent:         {Subject, Owners, Agents},
	AskClosed:           {Subject, Owners, Agents},
	GroupOrderCalledOff: {Subject, Owners, Agents},
}

func Allowed(e Event) []Audience { return slices.Clone(allowed[e]) }

func Default(e Event) (Rule, error) {
	r, ok := defaults()[e]
	if !ok {
		return Rule{}, ErrUnknownEvent
	}
	return r, nil
}

func defaults() map[Event]Rule {
	return map[Event]Rule{
		JoinAsked:           {Event: JoinAsked, Told: []Audience{GroupLeaders}, Mutable: true},
		JoinApproved:        {Event: JoinApproved, Told: []Audience{Subject}, Mutable: true},
		JoinDeclined:        {Event: JoinDeclined, Told: []Audience{Subject}, Mutable: true},
		ThreadStarted:       {Event: ThreadStarted, Told: []Audience{GroupLeaders}, Fallback: []Audience{Owners, Agents}, Mutable: true},
		ThreadDeclined:      {Event: ThreadDeclined, Told: []Audience{Subject}, Mutable: true},
		ThreadReply:         {Event: ThreadReply, Told: []Audience{Thread}, Mutable: true},
		FormSent:            {Event: FormSent, Told: []Audience{Group}, Mutable: false, FixedMute: true},
		FormPrivateChat:     {Event: FormPrivateChat, Told: []Audience{Owners, Agents}, Mutable: true},
		Invited:             {Event: Invited, Told: []Audience{Subject}, Mutable: true},
		SupplierApproved:    {Event: SupplierApproved, Told: []Audience{Subject}, Mutable: true},
		AskAnswered:         {Event: AskAnswered, Told: []Audience{Subject}, Mutable: true},
		AskWaiting:          {Event: AskWaiting, Told: []Audience{Subject}, Mutable: true},
		RevisionAsked:       {Event: RevisionAsked, Told: []Audience{Subject}, Mutable: true},
		NoticePosted:        {Event: NoticePosted, Told: []Audience{Subject}, Mutable: true},
		QuoteSent:           {Event: QuoteSent, Told: []Audience{Subject}, Mutable: true},
		DraftWaiting:        {Event: DraftWaiting, Told: []Audience{Subject}, Mutable: true},
		CounterSent:         {Event: CounterSent, Told: []Audience{Subject}, Mutable: true},
		AskClosed:           {Event: AskClosed, Told: []Audience{Subject}, Mutable: true},
		GroupOrderCalledOff: {Event: GroupOrderCalledOff, Told: []Audience{Subject}, Mutable: true},
	}
}

func Effective(stored map[Event]Rule, e Event) (Rule, error) {
	if r, ok := stored[e]; ok {
		return r, nil
	}
	return Default(e)
}

func Validate(r Rule) (Rule, error) {
	base, err := Default(r.Event)
	if err != nil {
		return Rule{}, err
	}
	for _, list := range [][]Audience{r.Told, r.Fallback} {
		for _, a := range list {
			if !slices.Contains(allowed[r.Event], a) {
				return Rule{}, ErrAudienceRefused
			}
		}
	}
	if base.FixedMute && r.Mutable != base.Mutable {
		return Rule{}, ErrMuteFixed
	}
	r.FixedMute = base.FixedMute
	return r, nil
}
