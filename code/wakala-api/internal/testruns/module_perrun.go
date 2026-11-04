package testruns

import "context"

type perRun struct {
	name  string
	build func(runID string) Module
}

func (p perRun) Name() string { return p.name }

func (p perRun) Play(ctx context.Context, call Call) (Outcome, error) {
	return p.build(RunOf(ctx)).Play(ctx, call)
}

type sentFormDefault struct {
	stage *RunStage
	runID string
	inner Module
}

func (d sentFormDefault) Name() string { return d.inner.Name() }

func (d sentFormDefault) Play(ctx context.Context, call Call) (Outcome, error) {
	if id, _ := call.Args["form_id"].(string); id == "" {
		d.stage.mu.Lock()
		sent := d.stage.sent[d.runID]
		d.stage.mu.Unlock()
		if sent != "" {
			args := map[string]any{}
			for k, v := range call.Args {
				args[k] = v
			}
			args["form_id"] = sent
			call.Args = args
		}
	}
	return d.inner.Play(ctx, call)
}

type threadDefault struct {
	stage *RunStage
	runID string
	inner Module
}

func (d threadDefault) Name() string { return d.inner.Name() }

func (d threadDefault) Play(ctx context.Context, call Call) (Outcome, error) {
	if call.Endpoint != endpointMessagePost {
		return d.inner.Play(ctx, call)
	}
	thread, lines, err := d.stage.ensureThread(ctx, d.runID, call)
	if err != nil {
		return Outcome{}, err
	}
	args := map[string]any{}
	for k, v := range call.Args {
		args[k] = v
	}
	args["thread_id"], args["structure_id"] = thread, systemStructure
	delete(args, "attachment_id")
	delete(args, "attachment_kind")
	call.Args = args
	out, err := d.inner.Play(ctx, call)
	out.Trail = append(lines, out.Trail...)
	return out, err
}
