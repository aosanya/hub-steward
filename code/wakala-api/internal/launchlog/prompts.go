package launchlog

import "sync"

// Prompts lets a running launch ask the person a question and wait for the
// answer, without giving up what it is holding.
//
// There is exactly one question today — what to call the project, asked when
// the name they chose is already taken in their organization — and the reason
// it is asked mid-launch rather than by failing and starting again is the
// Supabase authorization code: it is single-use and already spent by this
// point, so a failed launch costs the person another trip through the consent
// screen. Waiting costs nothing but a held goroutine.
type Prompts struct {
	mu      sync.Mutex
	waiting map[string]chan string
}

// Ask registers launchID as waiting for an answer and returns the channel it
// will arrive on. Cancel must be called once the caller stops waiting —
// answered or not — or the launch stays askable forever.
//
// A second Ask for the same launch replaces the first, whose channel is closed:
// only one question is outstanding at a time.
func (p *Prompts) Ask(launchID string) (answers <-chan string, cancel func()) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.waiting == nil {
		p.waiting = map[string]chan string{}
	}
	if old, ok := p.waiting[launchID]; ok {
		close(old)
	}
	ch := make(chan string, 1)
	p.waiting[launchID] = ch

	var once sync.Once
	return ch, func() {
		once.Do(func() {
			p.mu.Lock()
			defer p.mu.Unlock()
			if cur, ok := p.waiting[launchID]; ok && cur == ch {
				delete(p.waiting, launchID)
			}
		})
	}
}

// Answer hands answer to a launch waiting on Ask. It reports false when
// nothing is waiting — an answer to a question already settled, or to a launch
// that is not this server's — so the route can say so rather than accept it
// silently. It never blocks: the channel is buffered and the answer is dropped
// if one is already queued.
func (p *Prompts) Answer(launchID, answer string) bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	ch, ok := p.waiting[launchID]
	if !ok {
		return false
	}
	select {
	case ch <- answer:
		return true
	default:
		return false
	}
}

// Waiting reports whether launchID is currently expecting an answer.
func (p *Prompts) Waiting(launchID string) bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	_, ok := p.waiting[launchID]
	return ok
}
