package mwanachamaagency

import (
	"context"
	"fmt"
	"sort"

	"wakalaserver/modules/agency/models"
)

type LibraryUsage struct {
	Code  string `json:"code"`
	Title string `json:"title"`
	Uses  int    `json:"uses"`
}

type HazardUsage struct {
	Code             string   `json:"code"`
	Title            string   `json:"title"`
	Uses             int      `json:"used_in"`
	RiskCodes        []string `json:"risk_codes"`
	ConsequenceCodes []string `json:"consequence_codes"`
}

type BowtieRef struct {
	Code  string `json:"code"`
	Title string `json:"title"`
}

type UnguardedPart struct {
	Kind    models.TargetType `json:"kind"`
	Code    string            `json:"code"`
	Title   string            `json:"title"`
	Uses    int               `json:"uses"`
	Bowties []BowtieRef       `json:"bowties"`
}

func (m *agencyManager) ThreatUsage(ctx context.Context, draftID string) ([]LibraryUsage, error) {
	parts, err := m.libraryParts(ctx, draftID, models.TargetTypeThreat)
	if err != nil {
		return nil, fmt.Errorf("ThreatUsage: %w", err)
	}
	out := make([]LibraryUsage, 0, len(parts))
	for _, p := range parts {
		out = append(out, LibraryUsage{Code: p.Code, Title: p.Title, Uses: len(p.Bowties)})
	}
	return out, nil
}

func (m *agencyManager) ConsequenceUsage(ctx context.Context, draftID string) ([]LibraryUsage, error) {
	parts, err := m.libraryParts(ctx, draftID, models.TargetTypeConsequence)
	if err != nil {
		return nil, fmt.Errorf("ConsequenceUsage: %w", err)
	}
	out := make([]LibraryUsage, 0, len(parts))
	for _, p := range parts {
		out = append(out, LibraryUsage{Code: p.Code, Title: p.Title, Uses: len(p.Bowties)})
	}
	return out, nil
}

func (m *agencyManager) ListUnguardedParts(ctx context.Context, draftID string) ([]UnguardedPart, error) {
	guarded, err := m.guardedCodes(ctx, draftID)
	if err != nil {
		return nil, fmt.Errorf("ListUnguardedParts: %w", err)
	}
	var out []UnguardedPart
	for _, kind := range []models.TargetType{models.TargetTypeThreat, models.TargetTypeConsequence} {
		parts, err := m.libraryParts(ctx, draftID, kind)
		if err != nil {
			return nil, fmt.Errorf("ListUnguardedParts: %w", err)
		}
		for _, p := range parts {
			if !guarded[kind][p.Code] {
				out = append(out, p)
			}
		}
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].Uses > out[j].Uses })
	return out, nil
}

func (m *agencyManager) guardedCodes(ctx context.Context, draftID string) (map[models.TargetType]map[string]bool, error) {
	attachments, err := list[models.ControlAttachment](m, scopeQuery(m.q(ctx, roleControlAttachment), draftID), roleControlAttachment)
	if err != nil {
		return nil, err
	}
	guarded := map[models.TargetType]map[string]bool{
		models.TargetTypeThreat:      {},
		models.TargetTypeConsequence: {},
	}
	for _, a := range attachments {
		if set, ok := guarded[a.TargetType]; ok {
			set[a.TargetCode] = true
		}
	}
	return guarded, nil
}

func (m *agencyManager) libraryParts(ctx context.Context, draftID string, kind models.TargetType) ([]UnguardedPart, error) {
	risks, err := list[models.Risk](m, scopeQuery(m.q(ctx, roleRisk), draftID), roleRisk)
	if err != nil {
		return nil, err
	}
	riskByCode := make(map[string]models.Risk, len(risks))
	for _, r := range risks {
		riskByCode[r.Code] = r
	}

	type titled struct{ code, title string }
	var parts []titled
	linked := map[string][]string{}

	if kind == models.TargetTypeThreat {
		rows, err := list[models.Threat](m, scopeQuery(m.q(ctx, roleThreat).Order("created_at"), draftID), roleThreat)
		if err != nil {
			return nil, err
		}
		for _, r := range rows {
			if !r.Deleted {
				parts = append(parts, titled{r.Code, r.Title})
			}
		}
		links, err := list[models.RiskThreat](m, scopeQuery(m.q(ctx, roleRiskThreat), draftID), roleRiskThreat)
		if err != nil {
			return nil, err
		}
		for _, l := range links {
			linked[l.ThreatCode] = append(linked[l.ThreatCode], l.RiskCode)
		}
	} else {
		rows, err := list[models.Consequence](m, scopeQuery(m.q(ctx, roleConsequence).Order("created_at"), draftID), roleConsequence)
		if err != nil {
			return nil, err
		}
		for _, r := range rows {
			if !r.Deleted {
				parts = append(parts, titled{r.Code, r.Title})
			}
		}
		links, err := list[models.RiskConsequence](m, scopeQuery(m.q(ctx, roleRiskConsequence), draftID), roleRiskConsequence)
		if err != nil {
			return nil, err
		}
		for _, l := range links {
			linked[l.ConsequenceCode] = append(linked[l.ConsequenceCode], l.RiskCode)
		}
	}

	out := make([]UnguardedPart, 0, len(parts))
	for _, p := range parts {
		part := UnguardedPart{Kind: kind, Code: p.code, Title: p.title, Bowties: []BowtieRef{}}
		seen := map[string]bool{}
		for _, riskCode := range linked[p.code] {
			r, ok := riskByCode[riskCode]
			if !ok || r.Deleted || seen[riskCode] {
				continue
			}
			seen[riskCode] = true
			part.Bowties = append(part.Bowties, BowtieRef{Code: r.Code, Title: r.Title})
		}
		part.Uses = len(part.Bowties)
		out = append(out, part)
	}
	return out, nil
}

func (m *agencyManager) HazardUsage(ctx context.Context, draftID string) ([]HazardUsage, error) {
	hazards, err := list[models.Hazard](m, scopeQuery(m.q(ctx, roleHazard).Order("created_at"), draftID), roleHazard)
	if err != nil {
		return nil, fmt.Errorf("HazardUsage: %w", err)
	}
	risks, err := list[models.Risk](m, scopeQuery(m.q(ctx, roleRisk).Order("created_at"), draftID), roleRisk)
	if err != nil {
		return nil, fmt.Errorf("HazardUsage: %w", err)
	}
	consequences, err := list[models.Consequence](m, scopeQuery(m.q(ctx, roleConsequence).Order("created_at"), draftID), roleConsequence)
	if err != nil {
		return nil, fmt.Errorf("HazardUsage: %w", err)
	}
	riskCodes := map[string][]string{}
	for _, r := range risks {
		if !r.Deleted && r.HazardCode != "" {
			riskCodes[r.HazardCode] = append(riskCodes[r.HazardCode], r.Code)
		}
	}
	consequenceCodes := map[string][]string{}
	for _, c := range consequences {
		if !c.Deleted && c.HazardCode != "" {
			consequenceCodes[c.HazardCode] = append(consequenceCodes[c.HazardCode], c.Code)
		}
	}
	out := make([]HazardUsage, 0, len(hazards))
	for _, h := range hazards {
		if h.Deleted {
			continue
		}
		u := HazardUsage{Code: h.Code, Title: h.Title, RiskCodes: append([]string{}, riskCodes[h.Code]...), ConsequenceCodes: append([]string{}, consequenceCodes[h.Code]...)}
		u.Uses = len(u.RiskCodes) + len(u.ConsequenceCodes)
		out = append(out, u)
	}
	return out, nil
}
