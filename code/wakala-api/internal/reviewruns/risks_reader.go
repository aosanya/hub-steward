package reviewruns

import (
	"context"
	"fmt"
	"strings"

	mwanachamaagency "wakalaserver/modules/agency"
	agencymodels "wakalaserver/modules/agency/models"
)

type RisksPathway struct {
	ID         string
	Code       string
	Title      string
	Scenario   string
	HazardCode string
}

type RisksEntry struct {
	ID           string
	Code         string
	Title        string
	TopEvent     string
	Hazard       string
	HazardCode   string
	Owner        string
	Threats      []RisksPathway
	Consequences []RisksPathway
}

type RisksHazard struct {
	Code         string
	Title        string
	Consequences int
}

type RisksHazardless struct {
	ID          string
	Code        string
	Title       string
	Description string
}

type RisksRule struct {
	Code string
	Text string
}

type RisksAttachment struct {
	TargetType string
	TargetCode string
}

type RisksControl struct {
	Code        string
	Text        string
	Action      string
	Condition   string
	OnBreach    string
	Severity    string
	Strength    string
	Attachments []RisksAttachment
}

type RisksLibraryUse struct {
	Kind  string
	Code  string
	Title string
	Uses  int
}

type RisksSnapshot struct {
	Risks            []RisksEntry
	Hazards          []RisksHazard
	Hazardless       []RisksHazardless
	Rules            []RisksRule
	Controls         []RisksControl
	ControlEditors   []string
	ControlApprovers []string
	LibraryUses      []RisksLibraryUse
}

type RisksSource interface {
	ListRisks(ctx context.Context, draftID string) (RisksSnapshot, error)
}

func NewRisksReader(src RisksSource) DraftReader {
	return DraftReaderFunc(func(ctx context.Context, draftID string) (string, error) {
		snapshot, err := src.ListRisks(ctx, draftID)
		if err != nil {
			return "", err
		}
		return RisksText(snapshot), nil
	})
}

func risksReadFailure(err error) error {
	return fmt.Errorf("The risks of this draft could not be read: %s.", strings.TrimSuffix(err.Error(), "."))
}

func RisksText(s RisksSnapshot) string {
	var b strings.Builder
	if len(s.Risks) == 0 {
		b.WriteString("No risks are recorded for this draft.\n")
	} else {
		fmt.Fprintf(&b, "Risks: %d\n", len(s.Risks))
	}
	for _, r := range s.Risks {
		risksWriteEntry(&b, r)
	}
	risksWriteHazards(&b, s)
	risksWriteHazardless(&b, s)
	b.WriteString("\nRules of the agency:\n")
	if len(s.Rules) == 0 {
		b.WriteString("  none\n")
	}
	for _, r := range s.Rules {
		fmt.Fprintf(&b, "  - %s: %s\n", r.Code, r.Text)
	}
	risksWriteControls(&b, s)
	return b.String()
}

func risksWriteHazards(b *strings.Builder, s RisksSnapshot) {
	if len(s.Hazards) == 0 {
		return
	}
	b.WriteString("\nHazards of the agency and how many library consequences each owns:\n")
	for _, h := range s.Hazards {
		fmt.Fprintf(b, "  - %s (%s): %d consequences\n", h.Code, h.Title, h.Consequences)
	}
}

func risksWriteHazardless(b *strings.Builder, s RisksSnapshot) {
	if len(s.Hazardless) == 0 {
		return
	}
	b.WriteString("\nLibrary consequences that name no hazard:\n")
	for _, c := range s.Hazardless {
		fmt.Fprintf(b, "  - id %s, %s: %s\n", c.ID, c.Code, c.Title)
		fmt.Fprintf(b, "    description: %s\n", risksOr(c.Description, "none"))
	}
}

func risksWriteControls(b *strings.Builder, s RisksSnapshot) {
	b.WriteString("\nControls of the agency:\n")
	if len(s.Controls) == 0 {
		b.WriteString("  none\n")
	}
	for _, c := range s.Controls {
		fmt.Fprintf(b, "  - %s: %s\n", c.Code, c.Text)
		fmt.Fprintf(b, "    action: %s\n", risksOr(c.Action, "none"))
		fmt.Fprintf(b, "    condition: %s\n", risksOr(c.Condition, "none"))
		fmt.Fprintf(b, "    on breach: %s\n", risksOr(c.OnBreach, "none"))
		fmt.Fprintf(b, "    severity: %s\n", risksOr(c.Severity, "none"))
		fmt.Fprintf(b, "    strength: %s\n", risksOr(c.Strength, "unknown"))
		if len(c.Attachments) == 0 {
			b.WriteString("    attached to: nothing\n")
		}
		for _, a := range c.Attachments {
			fmt.Fprintf(b, "    attached to: %s %s\n", a.TargetType, a.TargetCode)
		}
	}
	fmt.Fprintf(b, "\nRoles holding controls.edit: %s\n", risksOr(strings.Join(s.ControlEditors, ", "), "none"))
	fmt.Fprintf(b, "Roles holding controls.approve: %s\n", risksOr(strings.Join(s.ControlApprovers, ", "), "none"))
	if len(s.LibraryUses) > 0 {
		b.WriteString("\nLibrary parts and how many bowties use each:\n")
	}
	for _, u := range s.LibraryUses {
		fmt.Fprintf(b, "  - %s %s (%s): used by %d\n", u.Kind, u.Code, u.Title, u.Uses)
	}
}

func risksWriteEntry(b *strings.Builder, r RisksEntry) {
	fmt.Fprintf(b, "\nRisk id %s (%s): %s\n", r.ID, risksOr(r.Code, "no code"), r.Title)
	fmt.Fprintf(b, "  top event: %s\n", risksOr(r.TopEvent, "none"))
	fmt.Fprintf(b, "  hazard: %s\n", risksOr(r.Hazard, "none"))
	if r.HazardCode != "" {
		fmt.Fprintf(b, "  hazard code: %s\n", r.HazardCode)
	}
	fmt.Fprintf(b, "  owner: %s\n", risksOr(r.Owner, "none"))
	risksWritePathways(b, "threat", r.Threats)
	risksWritePathways(b, "consequence", r.Consequences)
}

func risksWritePathways(b *strings.Builder, side string, pathways []RisksPathway) {
	if len(pathways) == 0 {
		fmt.Fprintf(b, "  %ss: none\n", side)
		return
	}
	for _, p := range pathways {
		fmt.Fprintf(b, "  %s id %s (%s): %s\n", side, p.ID, risksOr(p.Code, "no code"), p.Title)
		if p.HazardCode != "" {
			fmt.Fprintf(b, "    hazard code: %s\n", p.HazardCode)
		}
		if p.Scenario != "" {
			fmt.Fprintf(b, "    example: %s\n", p.Scenario)
		}
	}
}

func risksOr(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

type RisksAgency interface {
	ListRisks(ctx context.Context, draftID string, filter mwanachamaagency.RiskFilter) ([]agencymodels.Risk, error)
	ListRiskPathways(ctx context.Context, draftID string, filter mwanachamaagency.RiskPathwayFilter) ([]agencymodels.RiskPathway, error)
	ListRules(ctx context.Context, draftID string, filter mwanachamaagency.RuleFilter) ([]agencymodels.Rule, error)
}

type RisksControlsAgency interface {
	ListControls(ctx context.Context, draftID string, filter mwanachamaagency.ControlFilter) ([]agencymodels.Control, error)
	ListControlAttachments(ctx context.Context, controlID string) ([]agencymodels.ControlAttachment, error)
	ListRoles(ctx context.Context, draftID string, filter mwanachamaagency.RoleFilter) ([]agencymodels.Role, error)
}

type RisksLibraryAgency interface {
	ListHazards(ctx context.Context, draftID string, filter mwanachamaagency.LibraryPartFilter) ([]agencymodels.Hazard, error)
	ListConsequences(ctx context.Context, draftID string, filter mwanachamaagency.ConsequenceFilter) ([]agencymodels.Consequence, error)
	ListRiskConsequences(ctx context.Context, draftID string, filter mwanachamaagency.RiskConsequenceFilter) ([]agencymodels.RiskConsequence, error)
}

type RisksControlStrength func(ctx context.Context, draftID string, c agencymodels.Control) (agencymodels.ControlStrength, error)

type risksAgencySource struct {
	agency   RisksAgency
	controls RisksControlsAgency
	strength RisksControlStrength
	library  RisksLibraryAgency
}

func NewRisksAgencySource(agency RisksAgency) RisksSource {
	source := risksAgencySource{agency: agency}
	if library, ok := agency.(RisksLibraryAgency); ok {
		source.library = library
	}
	if controls, ok := agency.(RisksControlsAgency); ok {
		source.controls = controls
		source.strength = risksManagerStrength(agency)
	}
	return source
}

func NewRisksControlsSource(agency RisksAgency, controls RisksControlsAgency, strength RisksControlStrength) RisksSource {
	source := risksAgencySource{agency: agency, controls: controls, strength: strength}
	if library, ok := agency.(RisksLibraryAgency); ok {
		source.library = library
	}
	return source
}

func (s risksAgencySource) readLibrary(ctx context.Context, draftID string, out *RisksSnapshot) (map[string][]RisksPathway, error) {
	if s.library == nil {
		return nil, nil
	}
	hazards, err := s.library.ListHazards(ctx, draftID, mwanachamaagency.LibraryPartFilter{})
	if err != nil {
		return nil, err
	}
	consequences, err := s.library.ListConsequences(ctx, draftID, mwanachamaagency.ConsequenceFilter{})
	if err != nil {
		return nil, err
	}
	links, err := s.library.ListRiskConsequences(ctx, draftID, mwanachamaagency.RiskConsequenceFilter{})
	if err != nil {
		return nil, err
	}
	owned := map[string]int{}
	byCode := map[string]agencymodels.Consequence{}
	for _, c := range consequences {
		owned[c.HazardCode]++
		byCode[c.Code] = c
		if c.HazardCode == "" {
			out.Hazardless = append(out.Hazardless, RisksHazardless{ID: c.ID, Code: c.Code, Title: c.Title, Description: c.Description})
		}
	}
	for _, h := range hazards {
		out.Hazards = append(out.Hazards, RisksHazard{Code: h.Code, Title: h.Title, Consequences: owned[h.Code]})
	}
	arms := map[string][]RisksPathway{}
	for _, l := range links {
		c, ok := byCode[l.ConsequenceCode]
		if !ok {
			continue
		}
		arms[l.RiskCode] = append(arms[l.RiskCode], RisksPathway{ID: c.ID, Code: c.Code, Title: c.Title, Scenario: c.Description, HazardCode: c.HazardCode})
	}
	return arms, nil
}

func risksManagerStrength(agency RisksAgency) RisksControlStrength {
	manager, ok := agency.(mwanachamaagency.AgencyManager)
	if !ok {
		return nil
	}
	return func(ctx context.Context, draftID string, c agencymodels.Control) (agencymodels.ControlStrength, error) {
		return mwanachamaagency.ControlStrengthOf(ctx, manager, draftID, c)
	}
}

func (s risksAgencySource) readControls(ctx context.Context, draftID string, out *RisksSnapshot) error {
	if s.controls == nil {
		return nil
	}
	controls, err := s.controls.ListControls(ctx, draftID, mwanachamaagency.ControlFilter{})
	if err != nil {
		return err
	}
	for _, c := range controls {
		entry := RisksControl{Code: c.Code, Text: c.Text, Action: c.Action, Condition: risksCondition(c), OnBreach: string(c.OnBreach), Severity: string(c.Severity)}
		if s.strength != nil {
			strength, err := s.strength(ctx, draftID, c)
			if err != nil {
				return err
			}
			entry.Strength = string(strength)
		}
		attachments, err := s.controls.ListControlAttachments(ctx, c.ID)
		if err != nil {
			return err
		}
		for _, a := range attachments {
			entry.Attachments = append(entry.Attachments, RisksAttachment{TargetType: string(a.TargetType), TargetCode: a.TargetCode})
		}
		out.Controls = append(out.Controls, entry)
	}
	roles, err := s.controls.ListRoles(ctx, draftID, mwanachamaagency.RoleFilter{})
	if err != nil {
		return err
	}
	for _, r := range roles {
		for _, p := range r.Permissions {
			switch p {
			case "controls.edit":
				out.ControlEditors = append(out.ControlEditors, r.Code+" "+r.Name)
			case "controls.approve":
				out.ControlApprovers = append(out.ControlApprovers, r.Code+" "+r.Name)
			}
		}
	}
	return nil
}

func risksCondition(c agencymodels.Control) string {
	if c.CondField == "" {
		return ""
	}
	return strings.TrimSpace(fmt.Sprintf("%s %s %s", c.CondField, c.CondOperator, c.CondValue))
}

func (s risksAgencySource) ListRisks(ctx context.Context, draftID string) (RisksSnapshot, error) {
	risks, err := s.agency.ListRisks(ctx, draftID, mwanachamaagency.RiskFilter{})
	if err != nil {
		return RisksSnapshot{}, err
	}
	pathways, err := s.agency.ListRiskPathways(ctx, draftID, mwanachamaagency.RiskPathwayFilter{})
	if err != nil {
		return RisksSnapshot{}, err
	}
	rules, err := s.agency.ListRules(ctx, draftID, mwanachamaagency.RuleFilter{})
	if err != nil {
		return RisksSnapshot{}, err
	}
	var out RisksSnapshot
	linked, err := s.readLibrary(ctx, draftID, &out)
	if err != nil {
		return RisksSnapshot{}, err
	}
	for _, r := range risks {
		entry := RisksEntry{ID: r.ID, Code: r.Code, Title: r.Title, TopEvent: r.TopEvent, Hazard: r.Hazard, HazardCode: r.HazardCode, Owner: r.Owner}
		for _, p := range pathways {
			if p.RiskID != r.ID {
				continue
			}
			arm := RisksPathway{ID: p.ID, Code: p.Code, Title: p.Title, Scenario: p.Scenario}
			if p.Side == agencymodels.RiskSideConsequence {
				if s.library != nil {
					continue
				}
				entry.Consequences = append(entry.Consequences, arm)
			} else {
				entry.Threats = append(entry.Threats, arm)
			}
		}
		if s.library != nil {
			entry.Consequences = linked[r.Code]
		}
		out.Risks = append(out.Risks, entry)
	}
	for _, r := range rules {
		out.Rules = append(out.Rules, RisksRule{Code: r.Code, Text: r.Text})
	}
	if err := s.readControls(ctx, draftID, &out); err != nil {
		return RisksSnapshot{}, err
	}
	return out, nil
}
