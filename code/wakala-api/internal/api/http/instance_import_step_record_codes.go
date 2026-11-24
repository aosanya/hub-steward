package http

import "context"

func (im *importer) applyReadableStepRecordCodes(ctx context.Context, in importRequest) {
	for _, wi := range in.WorkItems {
		readable := im.readableCodes.resolveOr(wi.RecordCode)
		if wi.RecordCode == "" || readable == wi.RecordCode {
			continue
		}
		id, ok := im.workItems.resolve(firstNonEmpty(wi.ID, wi.Code))
		if !ok {
			continue
		}
		step, err := im.mgr.GetWorkItem(ctx, id)
		if err != nil {
			im.fail("work item %q: %v", wi.Title, err)
			continue
		}
		if step.RecordCode == readable {
			continue
		}
		step.RecordCode = readable
		if _, err := im.mgr.UpdateWorkItem(ctx, step); err != nil {
			im.fail("work item %q: %v", wi.Title, err)
		}
	}
}
