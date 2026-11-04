package mwanachamaworkspace

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"gorm.io/gorm"

	"wakalaserver/modules/shared/spec"
	"wakalaserver/modules/shared/specstore"
	"wakalaserver/modules/workspace/models"
)

const layoutHistoryKept = 20

type LayoutManager interface {
	ListLayouts(ctx context.Context, scope string, f models.LayoutFilter) ([]models.Layout, error)
	ReadLayout(ctx context.Context, layoutID, subject string) (models.ResolvedLayout, error)
	CreateLayout(ctx context.Context, l models.Layout) (models.Layout, error)
	UpdateLayout(ctx context.Context, l models.Layout) (models.Layout, error)
	PublishLayout(ctx context.Context, layoutID, subject string) (models.Layout, error)
	ProposeLayout(ctx context.Context, layoutID string, p models.LayoutProposal) (models.LayoutDiff, error)
	PatchLayout(ctx context.Context, layoutID string, p models.LayoutProposal) (models.LayoutApplied, error)
	RevertLayout(ctx context.Context, layoutID string, r models.LayoutRevert) (models.LayoutApplied, error)
	CopyLayout(ctx context.Context, layoutID string, c models.LayoutCopy) (models.Layout, error)
	ListLayoutChanges(ctx context.Context, layoutID string, f models.LayoutChangeFilter) ([]models.LayoutChange, error)
	ChooseLayout(ctx context.Context, c models.LayoutChoice) (models.LayoutChoice, error)
	ChosenLayout(ctx context.Context, workbookID, subject string) (models.LayoutChoice, error)
}

type layouts struct {
	db    *gorm.DB
	store *store
	spec  *spec.Spec
}

func DeclaresLayouts(s *spec.Spec) bool {
	if s == nil {
		return false
	}
	for _, role := range []string{roleLayout, roleLayoutChange, roleLayoutChoice} {
		if _, ok := s.ByRole(role); !ok {
			return false
		}
	}
	return true
}

func NewLayoutManager(db *gorm.DB, s *spec.Spec) (LayoutManager, error) {
	if !DeclaresLayouts(s) {
		return nil, ErrLayoutsNotDeclared
	}
	st, err := newStore(db, s, map[string]any{
		roleLayout:       models.Layout{},
		roleLayoutChange: models.LayoutChange{},
		roleLayoutChoice: models.LayoutChoice{},
	})
	if err != nil {
		return nil, fmt.Errorf("NewLayoutManager: %w", err)
	}
	return &layouts{db: db, store: st, spec: s}, nil
}

func (m *layouts) query(ctx context.Context, role string) *gorm.DB {
	return m.store.Query(ctx, role)
}

func (m *layouts) get(ctx context.Context, layoutID string) (models.Layout, error) {
	if strings.TrimSpace(layoutID) == "" {
		return models.Layout{}, ErrLayoutNotFound
	}
	var out models.Layout
	q := m.query(ctx, roleLayout).Where(columnName("ID")+" = ?", layoutID)
	if err := m.store.Take(q, roleLayout, &out, ErrLayoutNotFound); err != nil {
		return models.Layout{}, err
	}
	if out.Deleted {
		return models.Layout{}, ErrLayoutNotFound
	}
	return out, nil
}

func (m *layouts) ListLayouts(ctx context.Context, scope string, f models.LayoutFilter) ([]models.Layout, error) {
	if strings.TrimSpace(scope) == "" {
		return nil, ErrInvalidLayout
	}
	q := m.query(ctx, roleLayout).
		Where(columnName("Scope")+" = ?", scope).
		Where(columnName("Deleted") + " = false")
	if f.Owner != "" {
		q = q.Where(columnName("Owner")+" = ?", f.Owner)
	}
	if f.State != "" {
		q = q.Where(columnName("State")+" = ?", string(f.State))
	}
	if f.Form != "" {
		q = q.Where(columnName("Form")+" = ?", string(f.Form))
	}
	q = q.Order(columnName("UpdatedAt") + " desc")
	if f.Limit > 0 {
		q = q.Limit(f.Limit)
	}

	out, err := specstore.List[models.Layout](m.store, q, roleLayout)
	if err != nil {
		return nil, fmt.Errorf("workspace: list layouts: %w", err)
	}
	return out, nil
}

func (m *layouts) resolve(ctx context.Context, l models.Layout) (models.ResolvedLayout, error) {
	if l.Form != models.LayoutFormPatch {
		body, err := decodeDocument(l.Body)
		if err != nil {
			return models.ResolvedLayout{}, err
		}
		raw, err := encodeDocument(body)
		if err != nil {
			return models.ResolvedLayout{}, err
		}
		return models.ResolvedLayout{
			Layout:   l,
			Body:     raw,
			Locks:    locksOf(body),
			SetAside: decodeAside(l.SetAside),
		}, nil
	}

	base, err := m.get(ctx, l.BaseID)
	if err != nil {
		return models.ResolvedLayout{}, err
	}
	baseBody, err := decodeDocument(base.Body)
	if err != nil {
		return models.ResolvedLayout{}, err
	}
	patch, err := decodeDocument(l.Body)
	if err != nil {
		return models.ResolvedLayout{}, err
	}

	locks := locksOf(baseBody)
	aside := []string{}
	kept, _ := dropLocked(patch, "", locks, &aside)
	body := applyPatch(baseBody, kept)
	body, err = writeLocksBack(body, baseBody, locks)
	if err != nil {
		return models.ResolvedLayout{}, err
	}
	raw, err := encodeDocument(body)
	if err != nil {
		return models.ResolvedLayout{}, err
	}
	return models.ResolvedLayout{
		Layout:   l,
		Body:     raw,
		Locks:    locks,
		SetAside: sortedAside(aside),
		Base:     &base,
		Stale:    l.BaseVersion != 0 && l.BaseVersion != base.Version,
	}, nil
}

func (m *layouts) ReadLayout(ctx context.Context, layoutID, subject string) (models.ResolvedLayout, error) {
	l, err := m.get(ctx, layoutID)
	if err != nil {
		return models.ResolvedLayout{}, err
	}
	out, err := m.resolve(ctx, l)
	if err != nil {
		return models.ResolvedLayout{}, err
	}
	if out.Stale && subject != "" && l.Owner == subject {
		if err := m.settle(ctx, l, out); err != nil {
			return models.ResolvedLayout{}, err
		}
		out.Layout.BaseVersion = out.Base.Version
		out.Layout.SetAside, _ = json.Marshal(out.SetAside)
	}
	return out, nil
}

func (m *layouts) settle(ctx context.Context, l models.Layout, r models.ResolvedLayout) error {
	aside, err := json.Marshal(r.SetAside)
	if err != nil {
		return err
	}
	err = m.query(ctx, roleLayout).
		Where(columnName("ID")+" = ?", l.ID).
		Updates(map[string]any{
			columnName("BaseVersion"): r.Base.Version,
			columnName("SetAside"):    string(aside),
			columnName("UpdatedAt"):   models.NowRFC3339(),
		}).Error
	if err != nil {
		return fmt.Errorf("workspace: settle layout: %w", err)
	}
	return nil
}

func (m *layouts) CreateLayout(ctx context.Context, l models.Layout) (models.Layout, error) {
	if strings.TrimSpace(l.Scope) == "" || strings.TrimSpace(l.Owner) == "" || strings.TrimSpace(l.Title) == "" {
		return models.Layout{}, ErrInvalidLayout
	}
	if l.Form == "" {
		l.Form = models.LayoutFormWhole
	}
	if l.State == "" {
		l.State = models.LayoutStateDraft
	}
	if l.Form == models.LayoutFormPatch {
		base, err := m.get(ctx, l.BaseID)
		if err != nil {
			return models.Layout{}, err
		}
		l.BaseVersion = base.Version
	} else {
		l.BaseID, l.BaseVersion = "", 0
	}
	if _, err := decodeObject(l.Body); err != nil {
		return models.Layout{}, err
	}
	if err := Check(m.spec, roleLayout, l); err != nil {
		return models.Layout{}, fmt.Errorf("%w: %v", ErrInvalidLayout, err)
	}

	now := models.NowRFC3339()
	l.ID, l.Version, l.CreatedAt, l.UpdatedAt, l.Deleted = newID(), 1, now, now, false
	l.SetAside = nil
	if err := m.store.Insert(ctx, roleLayout, l); err != nil {
		return models.Layout{}, fmt.Errorf("workspace: create layout: %w", err)
	}
	return l, nil
}

func (m *layouts) UpdateLayout(ctx context.Context, l models.Layout) (models.Layout, error) {
	held, err := m.get(ctx, l.ID)
	if err != nil {
		return models.Layout{}, err
	}
	if l.Version != 0 && l.Version != held.Version {
		return models.Layout{}, ErrLayoutMoved
	}
	if strings.TrimSpace(l.Title) == "" {
		return models.Layout{}, ErrInvalidLayout
	}
	if _, err := decodeObject(l.Body); err != nil {
		return models.Layout{}, err
	}

	held.Title, held.Body = l.Title, l.Body
	held.Version, held.UpdatedAt = held.Version+1, models.NowRFC3339()
	err = m.query(ctx, roleLayout).
		Where(columnName("ID")+" = ?", held.ID).
		Updates(map[string]any{
			columnName("Title"):     held.Title,
			columnName("Body"):      string(held.Body),
			columnName("Version"):   held.Version,
			columnName("UpdatedAt"): held.UpdatedAt,
		}).Error
	if err != nil {
		return models.Layout{}, fmt.Errorf("workspace: update layout: %w", err)
	}
	return held, nil
}

func (m *layouts) PublishLayout(ctx context.Context, layoutID, subject string) (models.Layout, error) {
	l, err := m.get(ctx, layoutID)
	if err != nil {
		return models.Layout{}, err
	}
	if l.Form != models.LayoutFormWhole {
		return models.Layout{}, ErrLayoutNotWhole
	}
	if l.State == models.LayoutStatePublished {
		return models.Layout{}, ErrLayoutPublished
	}

	l.State, l.Version, l.UpdatedAt = models.LayoutStatePublished, l.Version+1, models.NowRFC3339()
	err = m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		err := tx.Table(m.store.Table(roleLayout)).
			Where(columnName("ID")+" = ?", l.ID).
			Updates(map[string]any{
				columnName("State"):     string(l.State),
				columnName("Version"):   l.Version,
				columnName("UpdatedAt"): l.UpdatedAt,
			}).Error
		if err != nil {
			return err
		}
		change := models.LayoutChange{
			ID: newID(), LayoutID: l.ID, Subject: subject,
			Via: models.LayoutViaDirect, At: l.UpdatedAt,
		}
		row, err := encode(m.store.Object(roleLayoutChange), change)
		if err != nil {
			return err
		}
		return tx.Table(m.store.Table(roleLayoutChange)).Create(row).Error
	})
	if err != nil {
		return models.Layout{}, fmt.Errorf("workspace: publish layout: %w", err)
	}
	return l, nil
}

type weighed struct {
	layout   models.Layout
	resolved models.ResolvedLayout
	asked    map[string]any
	kept     map[string]any
	aside    []string
}

func (m *layouts) weigh(ctx context.Context, layoutID string, raw json.RawMessage) (weighed, error) {
	l, err := m.get(ctx, layoutID)
	if err != nil {
		return weighed{}, err
	}
	resolved, err := m.resolve(ctx, l)
	if err != nil {
		return weighed{}, err
	}
	asked, err := decodeObject(raw)
	if err != nil {
		return weighed{}, err
	}

	aside := []string{}
	kept := asked
	if l.Form == models.LayoutFormPatch {
		dropped, _ := dropLocked(asked, "", resolved.Locks, &aside)
		if object, ok := dropped.(map[string]any); ok {
			kept = object
		} else {
			kept = map[string]any{}
		}
	}
	return weighed{layout: l, resolved: resolved, asked: asked, kept: kept, aside: sortedAside(aside)}, nil
}

func (w weighed) lines() []models.LayoutLine {
	body, err := decodeDocument(w.resolved.Body)
	if err != nil {
		return nil
	}
	out := []models.LayoutLine{}
	diffLines(body, w.kept, "", &out)
	return append(out, asideLines(w.aside)...)
}

func (m *layouts) ProposeLayout(ctx context.Context, layoutID string, p models.LayoutProposal) (models.LayoutDiff, error) {
	w, err := m.weigh(ctx, layoutID, p.Patch)
	if err != nil {
		return models.LayoutDiff{}, err
	}
	body, err := decodeDocument(w.resolved.Body)
	if err != nil {
		return models.LayoutDiff{}, err
	}

	next := applyPatch(body, w.kept)
	if w.layout.Form == models.LayoutFormPatch {
		next, err = writeLocksBack(next, body, w.resolved.Locks)
		if err != nil {
			return models.LayoutDiff{}, err
		}
	}

	keptRaw, err := encodeDocument(w.kept)
	if err != nil {
		return models.LayoutDiff{}, err
	}
	nextRaw, err := encodeDocument(next)
	if err != nil {
		return models.LayoutDiff{}, err
	}
	return models.LayoutDiff{
		LayoutID: layoutID,
		Lines:    w.lines(),
		Patch:    keptRaw,
		Body:     nextRaw,
		SetAside: w.aside,
	}, nil
}

func (m *layouts) PatchLayout(ctx context.Context, layoutID string, p models.LayoutProposal) (models.LayoutApplied, error) {
	w, err := m.weigh(ctx, layoutID, p.Patch)
	if err != nil {
		return models.LayoutApplied{}, err
	}
	stored, err := decodeDocument(w.layout.Body)
	if err != nil {
		return models.LayoutApplied{}, err
	}

	lines := w.lines()
	next := applyPatch(stored, w.asked)
	inverse := inverseOf(stored, w.asked)
	via := p.Via
	if via == "" {
		via = models.LayoutViaDirect
	}

	applied, err := m.write(ctx, w.layout, next, w.asked, inverse, via, p.Subject, false)
	if err != nil {
		return models.LayoutApplied{}, err
	}
	applied.Lines = lines
	return applied, nil
}

func (m *layouts) write(
	ctx context.Context,
	l models.Layout,
	next, patch, inverse any,
	via models.LayoutVia,
	subject string,
	spent bool,
) (models.LayoutApplied, error) {
	nextRaw, err := encodeDocument(next)
	if err != nil {
		return models.LayoutApplied{}, err
	}
	patchRaw, err := encodeDocument(patch)
	if err != nil {
		return models.LayoutApplied{}, err
	}
	inverseRaw, err := encodeDocument(inverse)
	if err != nil {
		return models.LayoutApplied{}, err
	}

	l.Body = nextRaw
	resolved, err := m.resolve(ctx, l)
	if err != nil {
		return models.LayoutApplied{}, err
	}
	asideRaw, err := encodeAside(resolved.SetAside)
	if err != nil {
		return models.LayoutApplied{}, err
	}

	now := models.NowRFC3339()
	change := models.LayoutChange{
		ID: newID(), LayoutID: l.ID, Subject: subject, Via: via,
		Patch: patchRaw, Inverse: inverseRaw, At: now,
	}
	if spent {
		change.RevertedAt = now
	}
	l.SetAside = asideRaw
	l.Version, l.UpdatedAt = l.Version+1, now

	err = m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		err := tx.Table(m.store.Table(roleLayout)).
			Where(columnName("ID")+" = ?", l.ID).
			Updates(map[string]any{
				columnName("Body"):      string(nextRaw),
				columnName("SetAside"):  asideColumn(asideRaw),
				columnName("Version"):   l.Version,
				columnName("UpdatedAt"): now,
			}).Error
		if err != nil {
			return err
		}
		row, err := encode(m.store.Object(roleLayoutChange), change)
		if err != nil {
			return err
		}
		if err := tx.Table(m.store.Table(roleLayoutChange)).Create(row).Error; err != nil {
			return err
		}
		return m.trim(tx, l.ID)
	})
	if err != nil {
		return models.LayoutApplied{}, fmt.Errorf("workspace: apply layout change: %w", err)
	}

	return models.LayoutApplied{
		Layout: l, Change: change, Body: resolved.Body, SetAside: resolved.SetAside,
	}, nil
}

func (m *layouts) trim(tx *gorm.DB, layoutID string) error {
	table := m.store.Table(roleLayoutChange)
	var at []string
	err := tx.Table(table).
		Where(columnName("LayoutID")+" = ?", layoutID).
		Order(columnName("At")+" desc").
		Offset(layoutHistoryKept).
		Limit(1).
		Pluck(columnName("At"), &at).Error
	if err != nil {
		return err
	}
	if len(at) == 0 {
		return nil
	}
	return tx.Table(table).
		Where(columnName("LayoutID")+" = ?", layoutID).
		Where(columnName("At")+" <= ?", at[0]).
		Delete(nil).Error
}

func (m *layouts) RevertLayout(ctx context.Context, layoutID string, r models.LayoutRevert) (models.LayoutApplied, error) {
	l, err := m.get(ctx, layoutID)
	if err != nil {
		return models.LayoutApplied{}, err
	}

	switch {
	case r.All:
		return m.clear(ctx, l, r.Subject)
	case r.Path != "":
		patch, err := patchClearing(r.Path)
		if err != nil {
			return models.LayoutApplied{}, err
		}
		raw, err := encodeDocument(patch)
		if err != nil {
			return models.LayoutApplied{}, err
		}
		return m.PatchLayout(ctx, layoutID, models.LayoutProposal{
			Patch: raw, Via: models.LayoutViaReset, Subject: r.Subject,
		})
	default:
		return m.undo(ctx, l, r)
	}
}

func (m *layouts) clear(ctx context.Context, l models.Layout, subject string) (models.LayoutApplied, error) {
	if l.Form != models.LayoutFormPatch {
		return models.LayoutApplied{}, ErrLayoutNotAPatch
	}
	stored, err := decodeDocument(l.Body)
	if err != nil {
		return models.LayoutApplied{}, err
	}
	empty := map[string]any{}
	inverse := stored
	applied, err := m.write(ctx, l, empty, empty, inverse, models.LayoutViaReset, subject, false)
	if err != nil {
		return models.LayoutApplied{}, err
	}
	applied.Layout.SetAside, _ = json.Marshal([]string{})
	return applied, nil
}

func (m *layouts) undo(ctx context.Context, l models.Layout, r models.LayoutRevert) (models.LayoutApplied, error) {
	change, err := m.lastChange(ctx, l.ID, r.ChangeID)
	if err != nil {
		return models.LayoutApplied{}, err
	}
	stored, err := decodeDocument(l.Body)
	if err != nil {
		return models.LayoutApplied{}, err
	}
	inverse, err := decodeDocument(change.Inverse)
	if err != nil {
		return models.LayoutApplied{}, err
	}

	next := applyPatch(stored, inverse)
	lines := []models.LayoutLine{}
	diffLines(stored, inverse, "", &lines)

	applied, err := m.write(ctx, l, next, inverse, inverseOf(stored, inverse), models.LayoutViaReset, r.Subject, true)
	if err != nil {
		return models.LayoutApplied{}, err
	}
	applied.Lines = lines

	now := models.NowRFC3339()
	err = m.query(ctx, roleLayoutChange).
		Where(columnName("ID")+" = ?", change.ID).
		Updates(map[string]any{columnName("RevertedAt"): now}).Error
	if err != nil {
		return models.LayoutApplied{}, fmt.Errorf("workspace: mark change reverted: %w", err)
	}
	return applied, nil
}

func (m *layouts) lastChange(ctx context.Context, layoutID, changeID string) (models.LayoutChange, error) {
	q := m.query(ctx, roleLayoutChange).Where(columnName("LayoutID")+" = ?", layoutID)
	if changeID != "" {
		q = q.Where(columnName("ID")+" = ?", changeID)
	} else {
		q = q.Where(columnName("RevertedAt") + " = ''").
			Where(columnName("Inverse") + " <> ''").
			Order(columnName("At") + " desc")
	}
	var out models.LayoutChange
	if err := m.store.Take(q, roleLayoutChange, &out, ErrLayoutChangeNotFound); err != nil {
		return models.LayoutChange{}, err
	}
	if out.RevertedAt != "" {
		return models.LayoutChange{}, ErrLayoutChangeReverted
	}
	if len(out.Inverse) == 0 {
		return models.LayoutChange{}, ErrLayoutChangeNotFound
	}
	return out, nil
}

func (m *layouts) ListLayoutChanges(ctx context.Context, layoutID string, f models.LayoutChangeFilter) ([]models.LayoutChange, error) {
	q := m.query(ctx, roleLayoutChange).
		Where(columnName("LayoutID")+" = ?", layoutID).
		Order(columnName("At") + " desc")
	if f.Limit > 0 {
		q = q.Limit(f.Limit)
	}
	out, err := specstore.List[models.LayoutChange](m.store, q, roleLayoutChange)
	if err != nil {
		return nil, fmt.Errorf("workspace: list layout changes: %w", err)
	}
	return out, nil
}

func (m *layouts) CopyLayout(ctx context.Context, layoutID string, c models.LayoutCopy) (models.Layout, error) {
	resolved, err := m.ReadLayout(ctx, layoutID, c.Subject)
	if err != nil {
		return models.Layout{}, err
	}
	owner, scope := c.To, c.Scope
	if c.Offer {
		if strings.TrimSpace(scope) == "" {
			scope = resolved.Layout.Scope
		}
		if strings.TrimSpace(owner) == "" {
			owner = scope
		}
	}
	if strings.TrimSpace(owner) == "" {
		return models.Layout{}, ErrInvalidCopy
	}
	if strings.TrimSpace(scope) == "" {
		scope = resolved.Layout.Scope
	}
	title := c.Title
	if strings.TrimSpace(title) == "" {
		title = resolved.Layout.Title
	}

	return m.CreateLayout(ctx, models.Layout{
		Scope: scope, Owner: owner, Title: title,
		Form: models.LayoutFormWhole, State: models.LayoutStateDraft,
		Body: resolved.Body,
	})
}

func (m *layouts) ChooseLayout(ctx context.Context, c models.LayoutChoice) (models.LayoutChoice, error) {
	if strings.TrimSpace(c.WorkbookID) == "" || strings.TrimSpace(c.Subject) == "" {
		return models.LayoutChoice{}, ErrInvalidChoice
	}
	if strings.TrimSpace(c.LayoutID) == "" {
		if err := m.forget(ctx, c.WorkbookID, c.Subject); err != nil {
			return models.LayoutChoice{}, err
		}
		return models.LayoutChoice{WorkbookID: c.WorkbookID, Subject: c.Subject}, nil
	}
	if _, err := m.get(ctx, c.LayoutID); err != nil {
		return models.LayoutChoice{}, err
	}

	c.ChosenAt = models.NowRFC3339()
	where := columnName("WorkbookID") + " = ? and " + columnName("Subject") + " = ?"
	var held int64
	err := m.query(ctx, roleLayoutChoice).Where(where, c.WorkbookID, c.Subject).Count(&held).Error
	if err != nil {
		return models.LayoutChoice{}, fmt.Errorf("workspace: read layout choice: %w", err)
	}
	if held > 0 {
		err = m.query(ctx, roleLayoutChoice).Where(where, c.WorkbookID, c.Subject).
			Updates(map[string]any{
				columnName("LayoutID"): c.LayoutID,
				columnName("ChosenAt"): c.ChosenAt,
			}).Error
	} else {
		err = m.store.Insert(ctx, roleLayoutChoice, c)
	}
	if err != nil {
		return models.LayoutChoice{}, fmt.Errorf("workspace: choose layout: %w", err)
	}
	return c, nil
}

func (m *layouts) forget(ctx context.Context, workbookID, subject string) error {
	err := m.query(ctx, roleLayoutChoice).
		Where(columnName("WorkbookID")+" = ?", workbookID).
		Where(columnName("Subject")+" = ?", subject).
		Delete(nil).Error
	if err != nil {
		return fmt.Errorf("workspace: clear layout choice: %w", err)
	}
	return nil
}

func (m *layouts) ChosenLayout(ctx context.Context, workbookID, subject string) (models.LayoutChoice, error) {
	q := m.query(ctx, roleLayoutChoice).
		Where(columnName("WorkbookID")+" = ?", workbookID).
		Where(columnName("Subject")+" = ?", subject)
	var out models.LayoutChoice
	if err := m.store.Take(q, roleLayoutChoice, &out, ErrChoiceNotFound); err != nil {
		return models.LayoutChoice{}, err
	}
	return out, nil
}
