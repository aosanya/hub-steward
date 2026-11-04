package mwanachamaagency

import (
	"context"
	"fmt"
	"strings"

	"gorm.io/gorm"

	"wakalaserver/modules/agency/models"
)

func invalidStep(format string, args ...any) error {
	return fmt.Errorf("%w: %s", ErrInvalidWorkItem, fmt.Sprintf(format, args...))
}

func validateStepShape(wi models.WorkItem) error {
	if strings.ContainsAny(wi.RoleID, ", \t\r\n;") {
		return invalidStep("a step has one role, got %q", wi.RoleID)
	}
	if err := validateStepLimit(wi); err != nil {
		return err
	}
	if wi.Kind == "" {
		if wi.RoleID != "" || wi.RunWorkflowID != "" || wi.FormName != "" || len(wi.Questions) > 0 || wi.Tool != "" || wi.HasLinks() || wi.HasChatFields() {
			return invalidStep("a step with a role, a form, a workflow to run, a chat or a link to another step needs a kind")
		}
		return nil
	}
	if !wi.Kind.Valid() {
		return invalidStep("kind %q is not one of %v", wi.Kind, models.StepKinds())
	}
	if wi.Kind.AgencyOnly() && wi.RoleID != "" {
		return invalidStep("a %s step is always the agency's, so it names no role", wi.Kind)
	}
	if wi.Kind == models.StepKindRunWorkflow && wi.RunWorkflowID == "" {
		return invalidStep("a run_workflow step names the workflow it runs")
	}
	if wi.Kind != models.StepKindRunWorkflow && wi.RunWorkflowID != "" {
		return invalidStep("only a run_workflow step names a workflow to run")
	}
	if err := validateChatFields(wi); err != nil {
		return err
	}
	if err := validateStepLinks(wi); err != nil {
		return err
	}
	if err := validateStepTool(wi); err != nil {
		return err
	}
	return validateStepForm(wi)
}

func validateChatFields(wi models.WorkItem) error {
	if wi.Kind != models.StepKindChat {
		if wi.HasChatFields() {
			return invalidStep("only a chat step names an agent, a topic, an opening line, prompts, tools or workflows to start")
		}
		return nil
	}
	if wi.Tool != "" {
		return invalidStep("a chat step lists its tools in tools, not in tool")
	}
	if len(wi.Prompts) > models.MaxChatPrompts {
		return invalidStep("a chat step offers at most %d prompts, got %d", models.MaxChatPrompts, len(wi.Prompts))
	}
	if err := requireNoBlank("prompt", wi.Prompts); err != nil {
		return err
	}
	if err := requireNoBlank("tool", wi.Tools); err != nil {
		return err
	}
	return requireNoBlank("workflow to start", wi.StartWorkflowIDs)
}

func requireNoBlank(what string, values []string) error {
	for i, value := range values {
		if strings.TrimSpace(value) == "" {
			return invalidStep("%s %d of a chat step is blank", what, i+1)
		}
	}
	return nil
}

func validateStepLimit(wi models.WorkItem) error {
	switch {
	case wi.TimeLimitMinutes < 0:
		return invalidStep("a time limit is a number of minutes, not %d", wi.TimeLimitMinutes)
	case wi.TimeLimitMinutes == 0 && wi.CancelWorkflowID == "":
		return nil
	case wi.TimeLimitMinutes == 0:
		return invalidStep("a cancel workflow needs a time limit to wait for")
	case wi.CancelWorkflowID == "":
		return invalidStep("a step with a time limit names the cancel workflow that runs when it passes")
	case !wi.WaitsOnPerson():
		return invalidStep("only a fill_form or yes_no step that a role acts on waits on a person, so only it can carry a time limit")
	}
	return nil
}

func validateStepTool(wi models.WorkItem) error {
	if wi.Tool == "" {
		return nil
	}
	if wi.RoleID == "" {
		return invalidStep("only a step that a role acts on names a tool, because only a person uses one")
	}
	if strings.ContainsAny(wi.Tool, " \t\r\n,;") {
		return invalidStep("a step names one tool, by one word such as market_ask, got %q", wi.Tool)
	}
	return nil
}

func validateStepForm(wi models.WorkItem) error {
	if wi.AnswersSentForm() {
		if wi.FormName != "" || len(wi.Questions) > 0 {
			return invalidStep("a step that answers a sent form takes the form it was sent with, not one of its own")
		}
		return nil
	}
	if !wi.Kind.TakesForm() {
		if wi.FormName != "" || len(wi.Questions) > 0 {
			return invalidStep("a %s step takes no form", wi.Kind)
		}
		return nil
	}
	return validateForm(invalidStep, fmt.Sprintf("a %s step", wi.Kind), wi.FormName, wi.Questions)
}

func validateForm(invalid func(string, ...any) error, subject, formName string, questions []models.StepQuestion) error {
	if formName == "" {
		return invalid("%s names its form", subject)
	}
	if len(questions) == 0 {
		return invalid("the form %q of %s asks at least one question", formName, subject)
	}
	for i, q := range questions {
		if err := validateFormQuestion(invalid, i+1, q); err != nil {
			return err
		}
	}
	return nil
}

func validateFormQuestion(invalid func(string, ...any) error, number int, q models.StepQuestion) error {
	if strings.TrimSpace(q.Prompt) == "" {
		return invalid("question %d has no prompt", number)
	}
	if !q.AnswerType.Valid() {
		return invalid("question %d: answer type %q is not one of %s", number, q.AnswerType, answerTypeList())
	}
	picks := q.AnswerType.HasOptions()
	if picks && len(q.Options) == 0 && q.OptionsFrom == "" {
		return invalid("question %d is a pick question and names neither its options nor the list they come from", number)
	}
	if !picks && (len(q.Options) > 0 || q.OptionsFrom != "") {
		return invalid("question %d has options but is not a pick question", number)
	}
	return nil
}

func (m *agencyManager) validateChatPlacement(ctx context.Context, tx *gorm.DB, wi models.WorkItem) error {
	var w models.Workflow
	q := scopeQuery(tx.WithContext(ctx).Table(m.table(roleWorkflow)), wi.DraftID).Where("id = ?", wi.WorkflowID)
	if err := m.take(q, roleWorkflow, &w, ErrWorkflowNotFound); err != nil {
		return err
	}
	if !w.IsChat() {
		return invalidStep("a chat step belongs to a workflow that opens in a chat, and %s opens in a form", w.Code)
	}
	others, err := m.chatStepsOf(ctx, tx, wi.DraftID, wi.WorkflowID, wi.ID)
	if err != nil {
		return err
	}
	if others > 0 {
		return invalidStep("a workflow has one chat step, and %s already has one", w.Code)
	}
	return nil
}

func (m *agencyManager) validateStepReferences(ctx context.Context, tx *gorm.DB, wi models.WorkItem) error {
	if err := m.validateOwningWorkflow(ctx, tx, wi); err != nil {
		return err
	}
	if wi.Kind == models.StepKindChat {
		if err := m.validateChatPlacement(ctx, tx, wi); err != nil {
			return err
		}
	}
	if err := m.validateStepLinkReferences(ctx, tx, wi); err != nil {
		return err
	}
	if wi.RoleID != "" {
		if err := m.actorOfDraft(ctx, tx, wi.DraftID, wi.RoleID); err != nil {
			return err
		}
	}
	if wi.RunWorkflowID != "" {
		var w models.Workflow
		q := scopeQuery(tx.WithContext(ctx).Table(m.table(roleWorkflow)), wi.DraftID).Where("id = ?", wi.RunWorkflowID)
		if err := m.take(q, roleWorkflow, &w, ErrWorkflowNotFound); err != nil {
			return err
		}
		if wi.RunWorkflowID == wi.WorkflowID {
			return invalidStep("a step cannot run the workflow that owns it")
		}
	}
	if wi.AgentRoleID != "" {
		if err := m.actorOfDraft(ctx, tx, wi.DraftID, wi.AgentRoleID); err != nil {
			return err
		}
	}
	for _, id := range wi.StartWorkflowIDs {
		var w models.Workflow
		q := scopeQuery(tx.WithContext(ctx).Table(m.table(roleWorkflow)), wi.DraftID).Where("id = ?", id)
		if err := m.take(q, roleWorkflow, &w, ErrWorkflowNotFound); err != nil {
			return err
		}
		if id == wi.WorkflowID {
			return invalidStep("a chat step cannot lead to the workflow that owns it")
		}
	}
	if wi.CancelWorkflowID != "" {
		var w models.Workflow
		q := scopeQuery(tx.WithContext(ctx).Table(m.table(roleWorkflow)), wi.DraftID).Where("id = ?", wi.CancelWorkflowID)
		if err := m.take(q, roleWorkflow, &w, ErrWorkflowNotFound); err != nil {
			return err
		}
		if wi.CancelWorkflowID == wi.WorkflowID {
			return invalidStep("a step cannot cancel with the workflow that owns it")
		}
	}
	return nil
}

func (m *agencyManager) validateStep(ctx context.Context, tx *gorm.DB, wi models.WorkItem) error {
	if err := validateStepShape(wi); err != nil {
		return err
	}
	return m.validateStepReferences(ctx, tx, wi)
}

func (m *agencyManager) withActions(ctx context.Context, items ...models.WorkItem) ([]models.WorkItem, error) {
	names := map[string]string{}
	var runIDs, sentIDs []string
	for _, wi := range items {
		if wi.RunWorkflowID != "" {
			runIDs = append(runIDs, wi.RunWorkflowID)
		}
		if wi.AnswersSentForm() {
			sentIDs = append(sentIDs, wi.SentStepID)
		}
	}
	sentForms := map[string]string{}
	if len(sentIDs) > 0 {
		sent, err := list[models.WorkItem](m, m.q(ctx, roleWorkItem).Where("id IN ?", sentIDs), roleWorkItem)
		if err != nil {
			return nil, err
		}
		for _, s := range sent {
			sentForms[s.ID] = s.FormName
		}
	}
	if len(runIDs) > 0 {
		workflows, err := list[models.Workflow](m, m.q(ctx, roleWorkflow).Where("id IN ?", runIDs), roleWorkflow)
		if err != nil {
			return nil, err
		}
		for _, w := range workflows {
			names[w.ID] = w.Name
		}
	}
	out := make([]models.WorkItem, len(items))
	for i, wi := range items {
		wi.Action = models.ActionOf(wi.Kind, wi.FormName, names[wi.RunWorkflowID])
		if wi.AnswersSentForm() {
			wi.Action = models.AnswerActionOf(sentForms[wi.SentStepID])
		}
		out[i] = wi
	}
	return out, nil
}

func (m *agencyManager) withAction(ctx context.Context, wi models.WorkItem) (models.WorkItem, error) {
	out, err := m.withActions(ctx, wi)
	if err != nil {
		return models.WorkItem{}, err
	}
	return out[0], nil
}

func answerTypeList() string {
	names := make([]string, 0, len(models.AnswerTypes()))
	for _, t := range models.AnswerTypes() {
		names = append(names, string(t))
	}
	return strings.Join(names, ", ")
}

func (m *agencyManager) validateOwningWorkflow(ctx context.Context, tx *gorm.DB, wi models.WorkItem) error {
	var w models.Workflow
	q := scopeQuery(tx.WithContext(ctx).Table(m.table(roleWorkflow)), wi.DraftID).Where("id = ?", wi.WorkflowID)
	return m.take(q, roleWorkflow, &w, ErrWorkflowNotFound)
}
