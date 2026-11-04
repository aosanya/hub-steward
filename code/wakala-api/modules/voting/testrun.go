package voting

func (m *pollManager) ForRun(runID string) (PollManager, error) {
	scoped, err := m.st.ForRun(runID)
	if err != nil {
		return nil, err
	}
	run := *m
	run.st = scoped
	return &run, nil
}
