package mwanachamaagency

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"gorm.io/gorm"

	"wakalaserver/modules/agency/models"
)

type ImportResult struct {
	Draft       models.Draft `json:"draft"`
	Attachments int          `json:"attachments"`
}

func (m *agencyManager) ImportDocument(ctx context.Context, description string, doc models.AgencyDocument) (ImportResult, error) {
	var out ImportResult
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := m.ensureAgency(ctx, tx, doc.Agency); err != nil {
			return err
		}

		now := models.NowRFC3339()
		draft := models.Draft{
			ID:          newID(),
			Description: description,
			Status:      models.DraftStatusOpen,
			CreatedAt:   now,
			LastUpdated: now,
		}
		if err := m.copyRow(ctx, tx, roleDraft, draft); err != nil {
			return err
		}
		doc = convertLegacyStatements(doc)
		doc, err := m.convertLegacyPathways(ctx, tx, doc)
		if err != nil {
			return err
		}
		if err := applyDocumentToDraft(ctx, m, tx, draft.ID, doc, now); err != nil {
			return err
		}
		if err := m.addRequiredModules(ctx, tx, draft.ID, now); err != nil {
			return err
		}

		if err := m.advanceCodeSequences(ctx, tx, draft.ID); err != nil {
			return err
		}
		out = ImportResult{Draft: draft, Attachments: len(doc.ControlAttachments)}
		return nil
	})
	if err != nil {
		return ImportResult{}, fmt.Errorf("ImportDocument: %w", err)
	}
	return out, nil
}

func (m *agencyManager) addRequiredModules(ctx context.Context, tx *gorm.DB, draftID, now string) error {
	held, err := list[models.Module](m, scopeQuery(tx.WithContext(ctx).Table(m.table(roleModule)), draftID), roleModule)
	if err != nil {
		return fmt.Errorf("addRequiredModules: %w", err)
	}
	kinds, err := m.draftStepKinds(ctx, tx, draftID)
	if err != nil {
		return fmt.Errorf("addRequiredModules: %w", err)
	}

	present := make(map[string]bool, len(held))
	switchedOn := make(map[string]bool, len(held))
	for _, mod := range withEffectiveEnabled(held, kinds) {
		present[mod.Code] = true
		switchedOn[mod.Code] = mod.Enabled
	}

	for _, entry := range models.ModuleCatalog {
		if present[entry.Code] || !models.WithRequiredModules(switchedOn)[entry.Code] {
			continue
		}
		row := models.Module{
			ID: newID(), Code: entry.Code, DraftID: draftID, Name: entry.Name,
			Description: entry.Description, Enabled: true, Locked: entry.Locked,
			CreatedAt: now, LastUpdated: now,
		}
		if err := m.copyRow(ctx, tx, roleModule, row); err != nil {
			return fmt.Errorf("addRequiredModules: %w", err)
		}
	}
	return nil
}

func (m *agencyManager) ensureAgency(ctx context.Context, tx *gorm.DB, from models.DocumentAgency) error {
	_, err := m.findAgency(ctx, tx)
	if err == nil {
		return nil
	}
	if !errors.Is(err, ErrAgencyNotFound) {
		return err
	}

	now := models.NowRFC3339()
	return m.copyRow(ctx, tx, roleAgency, models.Agency{
		ID:                           newID(),
		Name:                         from.Name,
		Description:                  from.Description,
		Enabled:                      from.Enabled,
		DefaultFailurePipelineBudget: from.DefaultFailurePipelineBudget,
		InactivityTimeoutSeconds:     from.InactivityTimeoutSeconds,
		EventFlows:                   from.EventFlows,
		CreatedAt:                    now,
		LastUpdated:                  now,
	})
}

func convertLegacyStatements(doc models.AgencyDocument) models.AgencyDocument {
	held := make(map[string]bool, len(doc.Controls))
	for _, c := range doc.Controls {
		held[c.Code] = true
	}
	for _, statements := range [][]models.DocumentStatement{doc.Values, doc.Rules} {
		for _, st := range statements {
			if held[st.Code] {
				continue
			}
			held[st.Code] = true
			doc.Controls = append(doc.Controls, models.DocumentControl{ID: st.ID, Code: st.Code, Text: st.Text})
		}
	}
	for _, a := range doc.ValueAttachments {
		doc.ControlAttachments = append(doc.ControlAttachments, models.DocumentControlAttachment{
			ControlCode: a.ValueCode, TargetType: a.TargetType, TargetCode: a.TargetCode,
		})
	}
	for _, a := range doc.RuleAttachments {
		doc.ControlAttachments = append(doc.ControlAttachments, models.DocumentControlAttachment{
			ControlCode: a.RuleCode, TargetType: a.TargetType, TargetCode: a.TargetCode,
		})
	}
	doc.Values, doc.Rules, doc.ValueAttachments, doc.RuleAttachments = nil, nil, nil, nil
	doc.ControlAttachments = distinctControlAttachments(doc.ControlAttachments)
	return doc
}

func (m *agencyManager) convertLegacyPathways(ctx context.Context, tx *gorm.DB, doc models.AgencyDocument) (models.AgencyDocument, error) {
	carriesLinks := len(doc.RiskThreats)+len(doc.RiskConsequences) > 0
	if len(doc.RiskPathways) == 0 || carriesLinks {
		return doc, nil
	}
	riskCodes := make(map[string]string, len(doc.Risks))
	riskHazards := make(map[string]string, len(doc.Risks))
	for _, r := range doc.Risks {
		riskCodes[r.ID] = r.Code
		riskHazards[r.ID] = strings.TrimSpace(r.HazardCode)
	}
	threatByTitle := make(map[string]string)
	for _, t := range doc.Threats {
		key := strings.ToLower(strings.TrimSpace(t.Title))
		if _, held := threatByTitle[key]; !held {
			threatByTitle[key] = t.Code
		}
	}
	consequenceByKey := make(map[string]string)
	for _, c := range doc.Consequences {
		key := consequenceKey(c.Title, c.HazardCode)
		if _, held := consequenceByKey[key]; !held {
			consequenceByKey[key] = c.Code
		}
	}
	threatOf := make(map[string]string)
	consequencesOf := make(map[string][]string)
	threatLinks := make(map[models.DocumentRiskThreat]bool)
	consequenceLinks := make(map[models.DocumentRiskConsequence]bool)
	sequences := m.table(roleCodeSequence)

	for _, p := range doc.RiskPathways {
		title := strings.ToLower(strings.TrimSpace(p.Title))
		riskCode := riskCodes[p.RiskID]
		switch p.Side {
		case models.RiskSideThreat:
			code, held := threatByTitle[title]
			if !held {
				minted, err := nextCode(ctx, tx, sequences, "threat", "T")
				if err != nil {
					return doc, err
				}
				code = minted
				threatByTitle[title] = code
				doc.Threats = append(doc.Threats, models.DocumentThreat{ID: newID(), Code: code, Title: p.Title, Description: p.Scenario})
			}
			threatOf[p.Code] = code
			link := models.DocumentRiskThreat{RiskCode: riskCode, ThreatCode: code}
			if riskCode != "" && !threatLinks[link] {
				threatLinks[link] = true
				doc.RiskThreats = append(doc.RiskThreats, link)
			}
		case models.RiskSideConsequence:
			hazardCode := riskHazards[p.RiskID]
			key := consequenceKey(p.Title, hazardCode)
			code, held := consequenceByKey[key]
			if !held {
				minted, err := nextCode(ctx, tx, sequences, "consequence", "Q")
				if err != nil {
					return doc, err
				}
				code = minted
				consequenceByKey[key] = code
				doc.Consequences = append(doc.Consequences, models.DocumentConsequence{ID: newID(), Code: code, Title: p.Title, HazardCode: hazardCode, Description: p.Scenario})
			}
			consequencesOf[p.Code] = append(consequencesOf[p.Code], code)
			link := models.DocumentRiskConsequence{RiskCode: riskCode, ConsequenceCode: code}
			if riskCode != "" && !consequenceLinks[link] {
				consequenceLinks[link] = true
				doc.RiskConsequences = append(doc.RiskConsequences, link)
			}
		}
	}

	attachments := make([]models.DocumentControlAttachment, 0, len(doc.ControlAttachments))
	for _, a := range doc.ControlAttachments {
		if a.TargetType != string(models.TargetTypeRiskPathway) {
			attachments = append(attachments, a)
			continue
		}
		if code, isThreat := threatOf[a.TargetCode]; isThreat {
			a.TargetType, a.TargetCode = string(models.TargetTypeThreat), code
			attachments = append(attachments, a)
			continue
		}
		if codes, isConsequence := consequencesOf[a.TargetCode]; isConsequence {
			for _, code := range codes {
				a.TargetType, a.TargetCode = string(models.TargetTypeConsequence), code
				attachments = append(attachments, a)
			}
			continue
		}
		attachments = append(attachments, a)
	}
	doc.ControlAttachments = distinctControlAttachments(attachments)
	doc.RiskPathways = nil
	return doc, nil
}

func consequenceKey(title, hazardCode string) string {
	return strings.ToLower(strings.TrimSpace(title)) + "\x00" + strings.TrimSpace(hazardCode)
}

func distinctControlAttachments(in []models.DocumentControlAttachment) []models.DocumentControlAttachment {
	seen := make(map[models.DocumentControlAttachment]bool, len(in))
	var out []models.DocumentControlAttachment
	for _, a := range in {
		if seen[a] {
			continue
		}
		seen[a] = true
		out = append(out, a)
	}
	return out
}

// advanceCodeSequences moves each counter past the codes the document
// brought with it. An imported row keeps the code it was exported with, so
// a counter left at zero would mint a G-1 that already exists — and a code
// is what every attachment resolves through.
func (m *agencyManager) advanceCodeSequences(ctx context.Context, tx *gorm.DB, draftID string) error {
	sequences := m.table(roleCodeSequence)
	for _, c := range codedRoles {
		var codes []string
		if err := scopeQuery(tx.WithContext(ctx).Table(m.table(c.role)), draftID).
			Pluck("code", &codes).Error; err != nil {
			return fmt.Errorf("advanceCodeSequences: %w", err)
		}
		highest := 0
		for _, code := range codes {
			if n := numberIn(code, c.prefix); n > highest {
				highest = n
			}
		}
		if highest == 0 {
			continue
		}
		if err := raiseSequence(ctx, tx, sequences, c.entityType, highest+1); err != nil {
			return err
		}
	}
	return nil
}

func numberIn(code, prefix string) int {
	rest, found := strings.CutPrefix(code, prefix+"-")
	if !found {
		return 0
	}
	n, err := strconv.Atoi(rest)
	if err != nil {
		return 0
	}
	return n
}

func raiseSequence(ctx context.Context, tx *gorm.DB, table, entityType string, next int) error {
	var held []int
	if err := tx.WithContext(ctx).Table(table).
		Where("entity_type = ?", entityType).Pluck("next_number", &held).Error; err != nil {
		return fmt.Errorf("raiseSequence: %w", err)
	}
	if len(held) == 0 {
		err := tx.WithContext(ctx).Table(table).
			Create(map[string]any{"entity_type": entityType, "next_number": next}).Error
		if err != nil {
			return fmt.Errorf("raiseSequence: %w", err)
		}
		return nil
	}
	if held[0] >= next {
		return nil
	}
	err := tx.WithContext(ctx).Table(table).
		Where("entity_type = ?", entityType).Update("next_number", next).Error
	if err != nil {
		return fmt.Errorf("raiseSequence: %w", err)
	}
	return nil
}
