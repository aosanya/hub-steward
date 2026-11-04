package mwanachamaagency

import (
	"strings"

	"wakalaserver/modules/agency/models"
)

func catalogueActions() map[string]bool {
	actions := map[string]bool{}
	for _, p := range models.PermissionCatalog() {
		for _, a := range p.Actions {
			actions[a] = true
		}
	}
	return actions
}

func (s *issueScan) checkControls() error {
	controls, err := list[models.Control](s.m, s.scoped(roleControl), roleControl)
	if err != nil {
		return err
	}
	attachments, err := list[models.ControlAttachment](s.m, s.scoped(roleControlAttachment), roleControlAttachment)
	if err != nil {
		return err
	}
	workflowIDs, err := s.idSet(roleWorkflow)
	if err != nil {
		return err
	}
	pathways, err := list[models.RiskPathway](s.m, s.scoped(roleRiskPathway), roleRiskPathway)
	if err != nil {
		return err
	}
	sideOf := make(map[string]models.RiskSide, len(pathways))
	for _, p := range pathways {
		sideOf[p.Code] = p.Side
	}
	targets, err := s.attachmentTargets()
	if err != nil {
		return err
	}

	actions := catalogueActions()
	byCode := make(map[string]models.Control, len(controls))
	for _, c := range controls {
		byCode[c.Code] = c
		s.checkControlShape(c, actions, workflowIDs)
		if c.Enforced() {
			covered, err := s.m.controlCovered(s.ctx, s.tx, s.draftID, c.Code)
			if err != nil {
				return err
			}
			if !covered {
				s.add(models.IssueSeverityError, "control", c.ID,
					"Control %s is enforced and no scenario of this draft has passed against it", c.Code)
			}
		}
	}

	for _, a := range attachments {
		c, held := byCode[a.ControlCode]
		if !held {
			s.add(models.IssueSeverityError, "control_attachment", a.ID,
				"Attachment to %s %s names Control %s, which does not exist", a.TargetType, a.TargetCode, a.ControlCode)
			continue
		}
		if !targets[a.TargetType][a.TargetCode] {
			s.add(models.IssueSeverityError, "control_attachment", a.ID,
				"Control %s is attached to %s %s, which does not exist", QuoteIfUnsafe(a.ControlCode), a.TargetType, QuoteIfUnsafe(a.TargetCode))
			continue
		}
		if c.OnBreach != models.OnBreachRunWorkflow {
			continue
		}
		switch {
		case a.TargetType == models.TargetTypeThreat:
			s.add(models.IssueSeverityError, "control_attachment", a.ID,
				"Control %s runs a workflow after the event, so it cannot stand on threat %s", c.Code, QuoteIfUnsafe(a.TargetCode))
		case a.TargetType == models.TargetTypeRiskPathway && sideOf[a.TargetCode] == models.RiskSideThreat:
			s.add(models.IssueSeverityError, "control_attachment", a.ID,
				"Control %s runs a workflow after the event, so it cannot stand on threat pathway %s", c.Code, QuoteIfUnsafe(a.TargetCode))
		}
	}
	return nil
}

func (s *issueScan) checkControlShape(c models.Control, actions, workflowIDs map[string]bool) {
	if strings.TrimSpace(c.Text) == "" {
		s.add(models.IssueSeverityError, "control", c.ID, "Control %s has no text", c.Code)
	}
	if c.Action != "" && !actions[c.Action] {
		s.add(models.IssueSeverityError, "control", c.ID, "Control %s names action %q, which is not in the permission catalogue", c.Code, c.Action)
	}
	if c.Enforced() != (c.OnBreach != "") {
		s.add(models.IssueSeverityError, "control", c.ID, "Control %s must set an action and an on-breach outcome together, or neither", c.Code)
	}
	if c.OnBreach != "" && !c.OnBreach.Valid() {
		s.add(models.IssueSeverityError, "control", c.ID, "Control %s has unknown on-breach outcome %q", c.Code, c.OnBreach)
	}
	if c.Severity != "" && !c.Severity.Valid() {
		s.add(models.IssueSeverityError, "control", c.ID, "Control %s has unknown severity %q", c.Code, c.Severity)
	}
	if (c.CondField != "") != (c.CondOperator != "") || (c.CondField != "" && c.CondValue == "") {
		s.add(models.IssueSeverityError, "control", c.ID, "Control %s must set a condition field, operator and value together, or none", c.Code)
	}
	if c.CondOperator != "" && !c.CondOperator.Valid() {
		s.add(models.IssueSeverityError, "control", c.ID, "Control %s has unknown condition operator %q", c.Code, c.CondOperator)
	}
	if c.CondField != "" && c.Action == "" {
		s.add(models.IssueSeverityError, "control", c.ID, "Control %s has a condition but no action", c.Code)
	}
	switch {
	case c.OnBreach == models.OnBreachRunWorkflow && !workflowIDs[c.WorkflowID]:
		s.add(models.IssueSeverityError, "control", c.ID, "Control %s runs a workflow that is not in this draft", c.Code)
	case c.OnBreach != models.OnBreachRunWorkflow && c.WorkflowID != "":
		s.add(models.IssueSeverityError, "control", c.ID, "Control %s names a workflow but its outcome is not run_workflow", c.Code)
	}
}

func (s *issueScan) attachmentTargets() (map[models.TargetType]map[string]bool, error) {
	out := make(map[models.TargetType]map[string]bool, 6)
	for _, t := range []models.TargetType{
		models.TargetTypeRole, models.TargetTypeGoal, models.TargetTypeObjective,
		models.TargetTypeWorkflow, models.TargetTypeWorkItem,
	} {
		role, _, ok := s.m.targetRole(t)
		if !ok {
			continue
		}
		codes, err := s.codeSet(role)
		if err != nil {
			return nil, err
		}
		out[t] = codes
	}
	pathwayCodes, err := s.codeSet(roleRiskPathway)
	if err != nil {
		return nil, err
	}
	out[models.TargetTypeRiskPathway] = pathwayCodes
	for t, role := range map[models.TargetType]string{
		models.TargetTypeThreat:      roleThreat,
		models.TargetTypeConsequence: roleConsequence,
	} {
		codes, err := s.codeSet(role)
		if err != nil {
			return nil, err
		}
		out[t] = codes
	}
	return out, nil
}

func (s *issueScan) checkConsequenceHazards() error {
	hazards, err := list[models.Hazard](s.m, s.scoped(roleHazard), roleHazard)
	if err != nil {
		return err
	}
	consequences, err := list[models.Consequence](s.m, s.scoped(roleConsequence), roleConsequence)
	if err != nil {
		return err
	}
	risks, err := list[models.Risk](s.m, s.scoped(roleRisk), roleRisk)
	if err != nil {
		return err
	}
	links, err := list[models.RiskConsequence](s.m, s.scoped(roleRiskConsequence), roleRiskConsequence)
	if err != nil {
		return err
	}
	liveHazards := make(map[string]bool, len(hazards))
	for _, h := range hazards {
		if !h.Deleted {
			liveHazards[h.Code] = true
		}
	}
	hazardOfConsequence := make(map[string]string, len(consequences))
	for _, c := range consequences {
		if c.Deleted {
			continue
		}
		hazardOfConsequence[c.Code] = c.HazardCode
		switch {
		case strings.TrimSpace(c.HazardCode) == "":
			s.add(models.IssueSeverityError, "consequence", c.ID, "Consequence %s %q names no hazard", c.Code, c.Title)
		case !liveHazards[c.HazardCode]:
			s.add(models.IssueSeverityError, "consequence", c.ID,
				"Consequence %s %q names hazard %s, which does not exist", c.Code, c.Title, QuoteIfUnsafe(c.HazardCode))
		}
	}
	hazardOfRisk := make(map[string]string, len(risks))
	for _, r := range risks {
		hazardOfRisk[r.Code] = r.HazardCode
	}
	for _, l := range links {
		consequenceHazard, held := hazardOfConsequence[l.ConsequenceCode]
		if !held {
			continue
		}
		riskHazard := hazardOfRisk[l.RiskCode]
		switch {
		case riskHazard == "":
			s.add(models.IssueSeverityError, "risk_consequence", l.ID,
				"Risk %s links consequence %s but names no hazard", QuoteIfUnsafe(l.RiskCode), QuoteIfUnsafe(l.ConsequenceCode))
		case riskHazard != consequenceHazard:
			s.add(models.IssueSeverityError, "risk_consequence", l.ID,
				"Risk %s is under hazard %s but links consequence %s of hazard %s",
				QuoteIfUnsafe(l.RiskCode), riskHazard, QuoteIfUnsafe(l.ConsequenceCode), consequenceHazard)
		}
	}
	return nil
}
