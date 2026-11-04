package mwanachamacatalog

import (
	"context"
	"strings"

	"gorm.io/gorm"

	"wakalaserver/modules/catalog/models"
	"wakalaserver/modules/shared/spec"
)

func (m *catalogManager) ListPublicEntries(ctx context.Context, f ListFilter) ([]Entry, error) {
	f.Visibility = models.VisibilityPublic
	if f.Limit <= 0 || f.Limit > models.MaxPublicEntryLimit {
		f.Limit = models.MaxPublicEntryLimit
	}
	out, err := m.listEntries(ctx, f, m.now())
	for i := range out {
		out[i] = withoutWriter(out[i])
	}
	return out, err
}

func (m *catalogManager) ListEntries(ctx context.Context, f ListFilter) ([]Entry, error) {
	return m.listEntries(ctx, f, "")
}

func escapeLike(s string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(s)
}

func (m *catalogManager) listEntries(ctx context.Context, f ListFilter, publishedBy string) ([]Entry, error) {
	if len(f.Docs) > models.MaxDocFilters {
		return nil, ErrInvalidDocPath
	}
	q := m.entries(ctx).Where("deleted = ?", false)
	if publishedBy != "" {
		q = q.Where("(publish_at IS NULL OR publish_at = '' OR publish_at <= ?)", publishedBy)
	}
	if f.Visibility != "" {
		q = q.Where("visibility = ?", string(f.Visibility))
	}
	for _, d := range f.Docs {
		if !d.Valid() {
			return nil, ErrInvalidDocPath
		}
		q = q.Where(docPathExpr(m.db, d)+" = ?", d.Value)
	}
	if s := strings.TrimSpace(f.Search); s != "" {
		like := "%" + escapeLike(strings.ToLower(s)) + "%"
		q = q.Where(`(LOWER(name) LIKE ? ESCAPE '\' OR LOWER(summary) LIKE ? ESCAPE '\')`, like, like)
	}
	if f.Limit <= 0 {
		f.Limit = models.DefaultEntryLimit
	}
	q = q.Limit(f.Limit)
	if f.Offset > 0 {
		q = q.Offset(f.Offset)
	}

	var rows []map[string]any
	if err := q.Order("name, id").Find(&rows).Error; err != nil {
		return nil, err
	}

	o := m.st.Object(roleEntry)
	out := make([]Entry, 0, len(rows))
	for _, r := range rows {
		var e Entry
		if err := decode(o, r, &e); err != nil {
			return nil, err
		}
		e.Doc = ""
		out = append(out, e)
	}
	return out, nil
}

func docPathExpr(db *gorm.DB, d models.DocFilter) string {
	return spec.DocPathExpr("doc", d.Path, db.Dialector.Name())
}
