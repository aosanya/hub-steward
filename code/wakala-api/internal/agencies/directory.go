package agencies

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"
)

const DirectoryLimit = 50

type ListingChange struct {
	Listed   *bool   `json:"listed"`
	Purpose  *string `json:"purpose"`
	Place    *string `json:"place"`
	Audience *string `json:"audience"`
}

type DirectoryEntry struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Kind     string `json:"kind"`
	Purpose  string `json:"purpose"`
	Place    string `json:"place"`
	Audience string `json:"audience"`
	JoinMode string `json:"join_mode"`
}

func (c ListingChange) columns() map[string]any {
	cols := map[string]any{}
	if c.Listed != nil {
		cols["listed"] = *c.Listed
	}
	for column, value := range map[string]*string{"purpose": c.Purpose, "place": c.Place, "audience": c.Audience} {
		if value != nil {
			cols[column] = strings.TrimSpace(*value)
		}
	}
	return cols
}

func (r *registry) SetListing(ctx context.Context, instanceID string, change ListingChange) (Instance, error) {
	if _, err := r.GetInstance(ctx, instanceID); err != nil {
		return Instance{}, err
	}
	if cols := change.columns(); len(cols) > 0 {
		err := r.db.WithContext(ctx).Model(&instanceRow{}).
			Where("id = ?", instanceID).Updates(cols).Error
		r.tenantChanged(instanceID)
		if err != nil {
			return Instance{}, err
		}
	}
	return r.GetInstance(ctx, instanceID)
}

var likeEscaper = strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)

func (r *registry) SearchDirectory(ctx context.Context, query string) ([]DirectoryEntry, error) {
	if id, err := uuid.Parse(strings.TrimSpace(query)); err == nil {
		return r.directoryEntryByID(ctx, id.String())
	}
	q := r.db.WithContext(ctx).Model(&instanceRow{}).Where("listed = ?", true).Where("approval NOT IN ?", []string{ApprovalPending, ApprovalDeclined})
	if term := strings.ToLower(strings.TrimSpace(query)); term != "" {
		pattern := "%" + likeEscaper.Replace(term) + "%"
		q = q.Where(`LOWER(name) LIKE ? ESCAPE '\' OR LOWER(place) LIKE ? ESCAPE '\'`, pattern, pattern)
	}
	var rows []instanceRow
	if err := q.Order("name").Order("id").Limit(DirectoryLimit).Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]DirectoryEntry, 0, len(rows))
	for _, row := range rows {
		out = append(out, directoryEntryOf(rowToInstance(row)))
	}
	return out, nil
}

func (r *registry) directoryEntryByID(ctx context.Context, id string) ([]DirectoryEntry, error) {
	inst, err := r.GetInstance(ctx, id)
	if errors.Is(err, ErrInstanceNotFound) {
		return []DirectoryEntry{}, nil
	}
	if err != nil {
		return nil, err
	}
	if !inst.Approved() {
		return []DirectoryEntry{}, nil
	}
	return []DirectoryEntry{directoryEntryOf(inst)}, nil
}

func directoryEntryOf(inst Instance) DirectoryEntry {
	return DirectoryEntry{
		ID:       inst.ID,
		Name:     inst.Name,
		Kind:     inst.Kind,
		Purpose:  inst.Purpose,
		Place:    inst.Place,
		Audience: inst.Audience,
		JoinMode: inst.JoinMode,
	}
}
