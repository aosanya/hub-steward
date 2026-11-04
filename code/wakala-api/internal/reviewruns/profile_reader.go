package reviewruns

import (
	"context"
	"fmt"
	"strings"

	mwanachamaagency "wakalaserver/modules/agency"
)

const profileNoneSentence = "This agency has no name and no description yet."

type ProfileRow struct {
	Name        string
	Description string
}

type ProfileSource interface {
	GetProfile(ctx context.Context, draftID string) (ProfileRow, error)
}

type profileManagerSource struct {
	manager mwanachamaagency.AgencyManager
}

func NewProfileManagerSource(manager mwanachamaagency.AgencyManager) ProfileSource {
	return profileManagerSource{manager: manager}
}

func (s profileManagerSource) GetProfile(ctx context.Context, _ string) (ProfileRow, error) {
	agency, err := s.manager.GetAgency(ctx)
	if err != nil {
		return ProfileRow{}, err
	}
	return ProfileRow{Name: agency.Name, Description: agency.Description}, nil
}

func NewProfileReader(src ProfileSource) DraftReader {
	return DraftReaderFunc(func(ctx context.Context, draftID string) (string, error) {
		row, err := src.GetProfile(ctx, draftID)
		if err != nil {
			return "", fmt.Errorf("The profile of this agency could not be read: %w", err)
		}
		return profileText(row), nil
	})
}

func profileText(row ProfileRow) string {
	if strings.TrimSpace(row.Name) == "" && strings.TrimSpace(row.Description) == "" {
		return profileNoneSentence
	}
	return fmt.Sprintf("Name: %s\nDescription: %s\n", profileOrNone(row.Name), profileOrNone(row.Description))
}

func profileOrNone(text string) string {
	if strings.TrimSpace(text) == "" {
		return "(none)"
	}
	return text
}
