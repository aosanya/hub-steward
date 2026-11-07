package digitaltwin

func (m *twinManager) ForRun(runID string) (TwinManager, error) {
	scoped, err := m.st.ForRun(runID)
	if err != nil {
		return nil, err
	}
	run := *m
	run.st = scoped
	return &run, nil
}
