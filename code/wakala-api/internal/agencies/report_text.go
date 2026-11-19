package agencies

import (
	"context"
	"errors"
	"fmt"
	"slices"

	mwanachamagit "github.com/aosanya/mwanachama-backend-git"
	mwanachamaforms "wakalaserver/modules/forms"
)

const ReportsRepositoryName = "reports"

var ErrReportFileChanged = errors.New("the report file was changed after the commit it was published at")

func ReportsBranch(ctx context.Context, gm mwanachamagit.GitManager) (string, bool, error) {
	repositories, err := gm.ListRepositorySummaries(ctx)
	if err != nil {
		return "", false, err
	}
	for _, r := range repositories {
		if r.Name == ReportsRepositoryName && r.DefaultBranchID != "" {
			return r.DefaultBranchID, true, nil
		}
	}
	return "", false, nil
}

func (r *registry) reportTextIn(instanceID string) mwanachamaforms.ReportTextReader {
	return func(ctx context.Context, gitPath, gitCommit string) (string, error) {
		gm, err := r.GitManager(ctx, instanceID)
		if err != nil {
			return "", fmt.Errorf("reportTextIn: %w", err)
		}
		branchID, found, err := ReportsBranch(ctx, gm)
		if err != nil {
			return "", fmt.Errorf("reportTextIn: %w", err)
		}
		if !found {
			return "", mwanachamagit.ErrFileNotFound
		}
		if err := reportUnchangedSince(ctx, gm, branchID, gitPath, gitCommit); err != nil {
			return "", err
		}
		blob, err := gm.ReadFile(ctx, branchID, gitPath)
		if err != nil {
			return "", fmt.Errorf("reportTextIn: %w", err)
		}
		if blob.Encoding != "" && blob.Encoding != "utf-8" {
			return "", fmt.Errorf("reportTextIn: %s is stored as %s, not text", gitPath, blob.Encoding)
		}
		return blob.Content, nil
	}
}

func reportUnchangedSince(ctx context.Context, gm mwanachamagit.GitManager, branchID, gitPath, gitCommit string) error {
	chain, err := gm.Log(ctx, branchID, mwanachamagit.LogFilter{})
	if err != nil {
		return err
	}
	published := slices.IndexFunc(chain, func(c mwanachamagit.CommitEntry) bool { return c.SHA == gitCommit })
	if published < 0 {
		return mwanachamagit.ErrFileNotFound
	}
	touching, err := gm.Log(ctx, branchID, mwanachamagit.LogFilter{Path: gitPath, Limit: 0})
	if err != nil {
		return err
	}
	if len(touching) == 0 {
		return mwanachamagit.ErrFileNotFound
	}
	newest := slices.IndexFunc(chain, func(c mwanachamagit.CommitEntry) bool { return c.SHA == touching[0].SHA })
	if newest < published {
		return ErrReportFileChanged
	}
	return nil
}
