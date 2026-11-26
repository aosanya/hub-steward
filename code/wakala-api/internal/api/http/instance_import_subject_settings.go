package http

import (
	"context"
	"fmt"
	"slices"

	models "github.com/aosanya/mwanachama-backend-agency/models"
)

func (in importRequest) questionsOfRecord(code string) ([]models.StepQuestion, bool) {
	for _, r := range in.Records {
		if r.Code == code || r.ID == code {
			return r.Questions, true
		}
	}
	for _, wi := range in.WorkItems {
		if wi.RecordCode == code {
			return wi.Questions, true
		}
	}
	return nil, false
}

func (in importRequest) checkSubjectSettings() error {
	subjectOf := map[string]string{}
	for _, w := range in.Workflows {
		subjectOf[w.ID] = w.SubjectRecord
		if w.Code != "" {
			subjectOf[w.Code] = w.SubjectRecord
		}
	}
	for _, wi := range in.WorkItems {
		if len(wi.SetsSubject) == 0 {
			continue
		}
		code := subjectOf[wi.WorkflowID]
		if code == "" {
			return fmt.Errorf("work item %q sets a choice on its subject record, and its workflow names none", wi.Title)
		}
		questions, _ := in.questionsOfRecord(code)
		for i, setting := range wi.SetsSubject {
			at := slices.IndexFunc(questions, func(q models.StepQuestion) bool { return q.Prompt == setting.Field })
			switch {
			case at < 0:
				return fmt.Errorf("work item %q setting %d names the field %q, which the record %q does not ask", wi.Title, i+1, setting.Field, code)
			case questions[at].AnswerType != models.AnswerSingleChoice:
				return fmt.Errorf("work item %q setting %d names the field %q of the record %q, which is not a choice", wi.Title, i+1, setting.Field, code)
			case !slices.Contains(questions[at].Options, setting.To):
				return fmt.Errorf("work item %q setting %d sets %q, which is not an option of %q in the record %q", wi.Title, i+1, setting.To, setting.Field, code)
			}
		}
	}
	return nil
}

func (im *importer) applyStepSubjectSettings(ctx context.Context, in importRequest) {
	for _, wi := range in.WorkItems {
		if len(wi.SetsSubject) == 0 {
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
		step.SetsSubject = wi.SetsSubject
		if _, err := im.mgr.UpdateWorkItem(ctx, step); err != nil {
			im.fail("work item %q: %v", wi.Title, err)
		}
	}
}
