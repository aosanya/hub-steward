package agencies

import "sync"

type resumes struct {
	mu   sync.Mutex
	done map[string]*resumeState
}

type resumeState struct {
	mu   sync.Mutex
	done bool
}

func (r *resumes) state(id string) *resumeState {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.done == nil {
		r.done = map[string]*resumeState{}
	}
	if r.done[id] == nil {
		r.done[id] = &resumeState{}
	}
	return r.done[id]
}

func (r *resumes) once(id string, resume func() error) error {
	s := r.state(id)
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.done {
		return nil
	}
	if err := resume(); err != nil {
		return err
	}
	s.done = true
	return nil
}
