package http

import (
	"context"
	"regexp"
	"strings"
	"time"

	mwanachamaagency "wakalaserver/modules/agency"
	agencymodels "wakalaserver/modules/agency/models"

	"wakalaserver/internal/accounts"
)

const (
	stampedByPrompt = mwanachamaagency.ApprovedByPrompt
	stampedAtPrompt = mwanachamaagency.ApprovedAtPrompt

	approvalStampMissingName = "set your name in your profile before approving"
)

var sentenceEnd = regexp.MustCompile(`[.!?;\n]+`)

var ownNamePhrases = []string{"own name", "by name"}

func isApprovalStep(step agencymodels.WorkItem) bool {
	for _, text := range []string{step.Title, step.Description, step.Prompt} {
		for _, sentence := range sentenceEnd.Split(strings.ToLower(text), -1) {
			if approvesInOwnName(sentence) {
				return true
			}
		}
	}
	return false
}

func approvesInOwnName(sentence string) bool {
	approves := strings.Index(sentence, "approv")
	if approves < 0 {
		return false
	}
	for _, phrase := range ownNamePhrases {
		if strings.Contains(sentence[approves:], phrase) {
			return true
		}
	}
	return false
}

func refuseStampedPrompts[V any](answers map[string]V) error {
	for _, prompt := range []string{stampedByPrompt, stampedAtPrompt} {
		if _, forged := answers[prompt]; forged {
			return badRowError(prompt + " is written by the server when an approval is sent, so it cannot be answered")
		}
	}
	return nil
}

func (d *Deps) approvalStamp(ctx context.Context, instanceID string) (map[string]string, error) {
	directory, err := d.Registry.ActorManager(ctx, instanceID)
	if err != nil {
		return nil, err
	}
	actor, err := directory.GetActor(ctx, accounts.IDFromContext(ctx))
	if err != nil {
		return nil, err
	}
	name := strings.TrimSpace(actor.DisplayName)
	if name == "" {
		name = strings.TrimSpace(actor.FirstName + " " + actor.LastName)
	}
	if name == "" {
		return nil, badRowError(approvalStampMissingName)
	}
	return map[string]string{stampedByPrompt: name, stampedAtPrompt: time.Now().UTC().Format(time.RFC3339)}, nil
}
