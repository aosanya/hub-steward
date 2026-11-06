package reviewruns

import "context"

type fakeModel struct {
	answer Completion
	err    error
	system string
	user   string
}

func (f *fakeModel) Complete(_ context.Context, system, user string) (Completion, error) {
	f.system = system
	f.user = user
	return f.answer, f.err
}
