package mwanachamaworkspace

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"gorm.io/gorm"

	"wakalaserver/modules/shared/spec"
	"wakalaserver/modules/workspace/models"
)

type (
	Workbook        = models.Workbook
	Reference       = models.Reference
	Use             = models.Use
	Shortcut        = models.Shortcut
	Share           = models.Share
	ShareStatus     = models.ShareStatus
	WorkbookFilter  = models.WorkbookFilter
	ReferenceFilter = models.ReferenceFilter
	UseFilter       = models.UseFilter
	Layout          = models.Layout
	LayoutChange    = models.LayoutChange
	LayoutChoice    = models.LayoutChoice
	LayoutForm      = models.LayoutForm
	LayoutState     = models.LayoutState
	LayoutVia       = models.LayoutVia
)

const (
	ShareStatusActive  = models.ShareStatusActive
	ShareStatusRetired = models.ShareStatusRetired
)

type WorkspaceManager interface {
	CreateWorkbook(ctx context.Context, w models.Workbook) (models.Workbook, error)
	GetWorkbook(ctx context.Context, id string) (models.Workbook, error)
	ListWorkbooks(ctx context.Context, owner string, f models.WorkbookFilter) ([]models.Workbook, error)
	UpdateWorkbook(ctx context.Context, w models.Workbook) (models.Workbook, error)
	DeleteWorkbook(ctx context.Context, id string) error

	Touch(ctx context.Context, r models.Reference) (models.Reference, error)
	ListReferences(ctx context.Context, workbookID string, f models.ReferenceFilter) ([]models.Reference, error)
	DropReference(ctx context.Context, referenceID string) error

	Record(ctx context.Context, u models.Use) (models.Use, error)
	ListUses(ctx context.Context, workbookID string, f models.UseFilter) ([]models.Use, error)
	ListShortcuts(ctx context.Context, workbookID string) ([]models.Shortcut, error)

	IssueShare(ctx context.Context, workbookID, label, issuedBy string) (models.Share, string, error)
	ListShares(ctx context.Context, workbookID string) ([]models.Share, error)
	RetireShare(ctx context.Context, shareID string) error
	OpenWithKey(ctx context.Context, workbookID, key string) (models.Workbook, error)
}

type manager struct {
	db    *gorm.DB
	store *store
	spec  *spec.Spec
}

func NewWorkspaceManager(db *gorm.DB, s *spec.Spec) (WorkspaceManager, error) {
	st, err := newStore(db, s, map[string]any{
		roleWorkbook:  models.Workbook{},
		roleReference: models.Reference{},
		roleUse:       models.Use{},
		roleShortcut:  models.Shortcut{},
		roleShare:     models.Share{},
	})
	if err != nil {
		return nil, fmt.Errorf("NewWorkspaceManager: %w", err)
	}
	return &manager{db: db, store: st, spec: s}, nil
}

func Migrate(db *gorm.DB, s *spec.Spec) error { return spec.Migrate(db, s) }

func (m *manager) object(role string) spec.Object { return m.store.Object(role) }

func (m *manager) table(role string) string { return m.store.Table(role) }

func (m *manager) query(ctx context.Context, role string) *gorm.DB {
	return m.store.Query(ctx, role)
}

func (m *manager) rows(ctx context.Context, role string, q *gorm.DB, out func(map[string]any) error) error {
	var rows []map[string]any
	if err := q.Find(&rows).Error; err != nil {
		return err
	}
	for _, row := range rows {
		if err := out(row); err != nil {
			return err
		}
	}
	return nil
}

func (m *manager) CreateWorkbook(ctx context.Context, w models.Workbook) (models.Workbook, error) {
	if strings.TrimSpace(w.Owner) == "" || strings.TrimSpace(w.Title) == "" {
		return models.Workbook{}, ErrInvalidWorkbook
	}
	now := models.NowRFC3339()
	w.ID, w.CreatedAt, w.UpdatedAt, w.Deleted = newID(), now, now, false

	row, err := encode(m.object(roleWorkbook), w)
	if err != nil {
		return models.Workbook{}, err
	}
	if err := m.query(ctx, roleWorkbook).Create(row).Error; err != nil {
		return models.Workbook{}, fmt.Errorf("workspace: create workbook: %w", err)
	}
	return w, nil
}

func (m *manager) GetWorkbook(ctx context.Context, id string) (models.Workbook, error) {
	var row map[string]any
	err := m.query(ctx, roleWorkbook).Where(columnName("ID")+" = ?", id).Take(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return models.Workbook{}, ErrWorkbookNotFound
	}
	if err != nil {
		return models.Workbook{}, fmt.Errorf("workspace: read workbook: %w", err)
	}
	var out models.Workbook
	if err := decode(m.object(roleWorkbook), row, &out); err != nil {
		return models.Workbook{}, err
	}
	return out, nil
}

func (m *manager) ListWorkbooks(ctx context.Context, owner string, f models.WorkbookFilter) ([]models.Workbook, error) {
	if strings.TrimSpace(owner) == "" {
		return nil, ErrInvalidWorkbook
	}
	q := m.query(ctx, roleWorkbook).
		Where(columnName("Owner")+" = ?", owner).
		Where(columnName("Deleted") + " = false")
	if f.Search != "" {
		q = q.Where("lower("+columnName("Title")+") like ?", "%"+strings.ToLower(f.Search)+"%")
	}
	q = q.Order(columnName("UpdatedAt") + " desc")
	if f.Limit > 0 {
		q = q.Limit(f.Limit)
	}

	out := []models.Workbook{}
	err := m.rows(ctx, roleWorkbook, q, func(row map[string]any) error {
		var w models.Workbook
		if err := decode(m.object(roleWorkbook), row, &w); err != nil {
			return err
		}
		out = append(out, w)
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("workspace: list workbooks: %w", err)
	}
	return out, nil
}

func (m *manager) UpdateWorkbook(ctx context.Context, w models.Workbook) (models.Workbook, error) {
	existing, err := m.GetWorkbook(ctx, w.ID)
	if err != nil {
		return models.Workbook{}, err
	}
	if strings.TrimSpace(w.Title) == "" {
		return models.Workbook{}, ErrInvalidWorkbook
	}
	existing.Title, existing.Summary = w.Title, w.Summary
	existing.UpdatedAt = models.NowRFC3339()

	err = m.query(ctx, roleWorkbook).
		Where(columnName("ID")+" = ?", w.ID).
		Updates(map[string]any{
			columnName("Title"):     existing.Title,
			columnName("Summary"):   existing.Summary,
			columnName("UpdatedAt"): existing.UpdatedAt,
		}).Error
	if err != nil {
		return models.Workbook{}, fmt.Errorf("workspace: update workbook: %w", err)
	}
	return existing, nil
}

func (m *manager) DeleteWorkbook(ctx context.Context, id string) error {
	if _, err := m.GetWorkbook(ctx, id); err != nil {
		return err
	}
	err := m.query(ctx, roleWorkbook).
		Where(columnName("ID")+" = ?", id).
		Updates(map[string]any{
			columnName("Deleted"):   true,
			columnName("UpdatedAt"): models.NowRFC3339(),
		}).Error
	if err != nil {
		return fmt.Errorf("workspace: delete workbook: %w", err)
	}
	return nil
}
