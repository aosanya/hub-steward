package http

import (
	"context"
	"fmt"

	"github.com/aosanya/mwanachama-backend-agency/models"
)

func (in importRequest) checkHome() error {
	if err := models.ValidateHomeDocument(in.Home); err != nil {
		return fmt.Errorf("home: %w", err)
	}
	held := make(map[string]bool, len(in.Roles))
	for _, role := range in.Roles {
		held[role.Code] = true
	}
	for _, code := range models.HomeRoleCodes(in.Home) {
		if !held[code] {
			return fmt.Errorf("home: the role %q is not in the file", code)
		}
	}
	return nil
}

func (im *importer) applyHome(ctx context.Context, in importRequest) {
	im.applyHomeNodes(ctx, "", in.Home)
}

func (im *importer) applyHomeNodes(ctx context.Context, parentID string, nodes []models.DocumentHomeNode) {
	for _, node := range nodes {
		row := models.HomeEntryOfNode(node)
		row.DraftID, row.ParentID = im.draftID, parentID
		created, err := im.mgr.CreateHomeEntry(ctx, row)
		if err != nil {
			im.fail("home entry %q: %v", node.Key, err)
			continue
		}
		im.counted("home_entries")
		im.applyHomeNodes(ctx, created.ID, node.Entries)
	}
}
