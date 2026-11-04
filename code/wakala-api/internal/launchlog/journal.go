// Package launchlog is the running commentary on a launch: the steps
// internal/launch takes, kept in memory so the admin who started one can watch
// it happen instead of staring at "Launch started" for two minutes.
//
// It is deliberately not durable. The record of a launch is the website's
// launched_agency row — created before anything exists in the customer's
// account and moved along as it goes (internal/shopdb) — and that is what
// survives a restart and what "My agencies" reads. This holds only what is
// worth watching live, for as long as anyone is likely to be watching: a
// launch runs for a couple of minutes and is followed from the page that
// started it.
package launchlog

import (
	"sync"
	"time"
)

// Event is one step of one launch, as the page shows it.
type Event struct {
	Seq     int               `json:"seq"`
	At      time.Time         `json:"at"`
	Elapsed string            `json:"elapsed"`
	Step    string            `json:"step"`
	Fields  map[string]string `json:"fields,omitempty"`
	// Options are the answers a "naming" question will accept besides a new
	// name — the projects the person already has, for putting this agency
	// alongside an existing one.
	Options []string `json:"options,omitempty"`
	// State is "running" while the launch is going, "naming" while it is
	// waiting for the person to answer, then "ready" or "failed" exactly once.
	// A terminal event closes every watcher.
	State string `json:"state"`
}

// Terminal reports whether e ends the launch it belongs to. "naming" does not:
// the launch is still alive, holding a Supabase token it cannot get again,
// waiting to be told what to call the project.
func (e Event) Terminal() bool { return e.State == StateReady || e.State == StateFailed }

// The four values State takes.
const (
	StateRunning = "running"
	StateNaming  = "naming"
	StateReady   = "ready"
	StateFailed  = "failed"
)

const (
	defaultKeep   = 32
	defaultMax    = 256
	watcherBuffer = 64
)

// Journal holds the recent launches. The zero value is usable.
type Journal struct {
	// Keep is how many launches to remember, oldest evicted first.
	// Zero means 32.
	Keep int
	// Max is how many events to keep per launch. Zero means 256; past it the
	// launch keeps its first Max, since a launch that runs away is diagnosed
	// from where it went wrong rather than from the end of the flood.
	Max int

	mu      sync.Mutex
	streams map[string]*stream
	order   []string
}

type stream struct {
	events []Event
	subs   map[chan Event]struct{}
	done   bool
	listed bool
}

func (j *Journal) keep() int {
	if j.Keep > 0 {
		return j.Keep
	}
	return defaultKeep
}

func (j *Journal) max() int {
	if j.Max > 0 {
		return j.Max
	}
	return defaultMax
}

func (j *Journal) Append(launchID string, e Event) {
	j.mu.Lock()
	defer j.mu.Unlock()
	if j.streams == nil {
		j.streams = map[string]*stream{}
	}
	s := j.streams[launchID]
	if s == nil {
		s = &stream{subs: map[chan Event]struct{}{}}
		j.streams[launchID] = s
	}
	if !s.listed {
		s.listed = true
		j.order = append(j.order, launchID)
		j.evict()
	}
	if s.done {
		return
	}
	e.Seq = len(s.events) + 1
	if e.At.IsZero() {
		e.At = time.Now()
	}
	if len(s.events) < j.max() {
		s.events = append(s.events, e)
	}
	for ch := range s.subs {
		select {
		case ch <- e:
		default:
		}
	}
	if e.Terminal() {
		s.done = true
		for ch := range s.subs {
			close(ch)
		}
		s.subs = nil
	}
}

// evict drops the oldest launches once more than Keep are remembered. Callers
// hold the lock. A watcher on an evicted launch keeps its own channel and is
// simply never sent anything more.
func (j *Journal) evict() {
	for len(j.order) > j.keep() {
		oldest := j.order[0]
		j.order = j.order[1:]
		if s := j.streams[oldest]; s != nil {
			for ch := range s.subs {
				close(ch)
			}
		}
		delete(j.streams, oldest)
	}
}

func (j *Journal) Watch(launchID string) (replay []Event, live <-chan Event, stop func()) {
	j.mu.Lock()
	defer j.mu.Unlock()
	if j.streams == nil {
		j.streams = map[string]*stream{}
	}
	s := j.streams[launchID]
	if s == nil {
		s = &stream{subs: map[chan Event]struct{}{}}
		j.streams[launchID] = s
	}
	replay = append(replay, s.events...)

	ch := make(chan Event, watcherBuffer)
	if s.done {
		close(ch)
		return replay, ch, func() {}
	}
	s.subs[ch] = struct{}{}

	var once sync.Once
	return replay, ch, func() {
		once.Do(func() {
			j.mu.Lock()
			defer j.mu.Unlock()
			if st := j.streams[launchID]; st != nil {
				if _, watching := st.subs[ch]; watching {
					delete(st.subs, ch)
					close(ch)
				}
				if !st.listed && len(st.subs) == 0 {
					delete(j.streams, launchID)
				}
			}
		})
	}
}
