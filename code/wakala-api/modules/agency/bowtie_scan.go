package mwanachamaagency

import (
	"wakalaserver/modules/agency/models"
)

func (s *issueScan) checkBowties() error {
	risks, err := list[models.Risk](s.m, s.scoped(roleRisk), roleRisk)
	if err != nil {
		return err
	}
	threatLinks, err := list[models.RiskThreat](s.m, s.scoped(roleRiskThreat), roleRiskThreat)
	if err != nil {
		return err
	}
	consequenceLinks, err := list[models.RiskConsequence](s.m, s.scoped(roleRiskConsequence), roleRiskConsequence)
	if err != nil {
		return err
	}
	attachments, err := list[models.ControlAttachment](s.m, s.scoped(roleControlAttachment), roleControlAttachment)
	if err != nil {
		return err
	}
	threatsOf := make(map[string]int)
	for _, l := range threatLinks {
		threatsOf[l.RiskCode]++
	}
	consequencesOf := make(map[string]int)
	for _, l := range consequenceLinks {
		consequencesOf[l.RiskCode]++
	}
	for _, r := range risks {
		if r.Deleted {
			continue
		}
		s.checkBowtie(r, threatsOf[r.Code], consequencesOf[r.Code])
	}
	s.checkPartControls(threatLinks, consequenceLinks, attachments)
	return nil
}

func (s *issueScan) checkBowtie(r models.Risk, threats, consequences int) {
	if r.HazardCode == "" {
		s.add(models.IssueSeverityWarning, "risk", r.ID, "Bowtie %s %q names no hazard", r.Code, r.Title)
	}
	if r.Owner == "" {
		s.add(models.IssueSeverityWarning, "risk", r.ID, "Bowtie %s %q has no owner", r.Code, r.Title)
	}
	if threats == 0 {
		s.add(models.IssueSeverityWarning, "risk", r.ID, "Bowtie %s %q has no threat", r.Code, r.Title)
	}
	if consequences == 0 {
		s.add(models.IssueSeverityWarning, "risk", r.ID, "Bowtie %s %q has no consequence", r.Code, r.Title)
	}
}

func (s *issueScan) checkPartControls(threatLinks []models.RiskThreat, consequenceLinks []models.RiskConsequence, attachments []models.ControlAttachment) {
	guarded := map[models.TargetType]map[string]bool{models.TargetTypeThreat: {}, models.TargetTypeConsequence: {}}
	standing := make(map[string]int)
	for _, a := range attachments {
		set, isPart := guarded[a.TargetType]
		if !isPart {
			continue
		}
		set[a.TargetCode] = true
		standing[a.ControlCode]++
	}
	seen := make(map[string]bool)
	for _, l := range threatLinks {
		s.warnUnguarded(seen, guarded, models.TargetTypeThreat, l.ThreatCode, l.ID)
	}
	for _, l := range consequenceLinks {
		s.warnUnguarded(seen, guarded, models.TargetTypeConsequence, l.ConsequenceCode, l.ID)
	}
	for _, a := range attachments {
		if standing[a.ControlCode] > 1 && isLibraryPart(a.TargetType) && !seen["many:"+a.ControlCode] {
			seen["many:"+a.ControlCode] = true
			s.add(models.IssueSeverityWarning, "control_attachment", a.ID,
				"Control %s stands on %d threats or consequences; a control should guard one", QuoteIfUnsafe(a.ControlCode), standing[a.ControlCode])
		}
	}
}

func (s *issueScan) warnUnguarded(seen map[string]bool, guarded map[models.TargetType]map[string]bool, kind models.TargetType, code, linkID string) {
	key := string(kind) + ":" + code
	if seen[key] || guarded[kind][code] {
		return
	}
	seen[key] = true
	s.add(models.IssueSeverityWarning, "control_gap", linkID, "%s %s has no control", kind, QuoteIfUnsafe(code))
}

func isLibraryPart(t models.TargetType) bool {
	return t == models.TargetTypeThreat || t == models.TargetTypeConsequence
}
