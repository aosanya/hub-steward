package agencies

import (
	"context"
	"strings"
	"time"

	mwanachamaaccounting "wakalaserver/modules/accounting"
	mwanachamaactor "wakalaserver/modules/actor"
	mwanachamaagency "wakalaserver/modules/agency"
	mwanachamaassetmanager "wakalaserver/modules/assetmanager"
	mwanachamacatalog "wakalaserver/modules/catalog"
	mwanachamacomm "wakalaserver/modules/comm"
	mwanachamacustody "wakalaserver/modules/custody"
	mwanachamadigitaltwin "wakalaserver/modules/digitaltwin"
	mwanachamaengage "wakalaserver/modules/engage"
	mwanachamaforms "wakalaserver/modules/forms"
	mwanachamagit "wakalaserver/modules/git"
	mwanachamamarket "wakalaserver/modules/market"
	mwanachamariskmanager "wakalaserver/modules/riskmanager"
	mwanachamasources "wakalaserver/modules/sources"
	mwanachamataskmanager "wakalaserver/modules/taskmanager"
	mwanachamavoting "wakalaserver/modules/voting"

	"wakalaserver/internal/approvals"
	"wakalaserver/internal/authz"
	"wakalaserver/internal/dbpool"
)

type Standing struct {
	Member       bool
	Role         string
	AgencyRoleID string
	Instance     Instance
}

type EpochSource interface {
	Epochs() *authz.Epochs
}

type ActorAdopter interface {
	AdoptCaller(ctx context.Context, instanceID, subject string) error
}

func WithEpochs(e *authz.Epochs) Option {
	return func(r *registry) {
		if e != nil {
			r.epochs = e
		}
	}
}

func WithCacheEntries(max int) Option {
	return func(r *registry) {
		if max > 0 {
			r.cacheEntries = max
		}
	}
}

func (r *registry) Epochs() *authz.Epochs { return r.epochs }

func pooled[V any](ctx context.Context, c *authz.Cache[V], key string, build func(context.Context, string) (V, error)) (V, error) {
	return c.Get(ctx, key, func(ctx context.Context) (V, []string, error) {
		built, err := build(ctx, key)
		return built, nil, err
	})
}

func (r *registry) openCaches() {
	n := r.cacheEntries
	r.managers = authz.NewCache[mwanachamaagency.AgencyManager]("managers", nil, authz.WithTTL[mwanachamaagency.AgencyManager](0), authz.WithMaxEntries[mwanachamaagency.AgencyManager](n))
	r.ledgers = authz.NewCache[mwanachamaaccounting.LedgerRepository]("ledgers", nil, authz.WithTTL[mwanachamaaccounting.LedgerRepository](0), authz.WithMaxEntries[mwanachamaaccounting.LedgerRepository](n))
	r.boards = authz.NewCache[mwanachamataskmanager.TaskManager]("boards", nil, authz.WithTTL[mwanachamataskmanager.TaskManager](0), authz.WithMaxEntries[mwanachamataskmanager.TaskManager](n))
	r.catalogs = authz.NewCache[mwanachamacatalog.CatalogManager]("catalogs", nil, authz.WithTTL[mwanachamacatalog.CatalogManager](0), authz.WithMaxEntries[mwanachamacatalog.CatalogManager](n))
	r.gits = authz.NewCache[mwanachamagit.GitManager]("gits", nil, authz.WithTTL[mwanachamagit.GitManager](0), authz.WithMaxEntries[mwanachamagit.GitManager](n))
	r.sources = authz.NewCache[mwanachamasources.SourceManager]("sources", nil, authz.WithTTL[mwanachamasources.SourceManager](0), authz.WithMaxEntries[mwanachamasources.SourceManager](n))
	r.polls = authz.NewCache[mwanachamavoting.PollManager]("polls", nil, authz.WithTTL[mwanachamavoting.PollManager](0), authz.WithMaxEntries[mwanachamavoting.PollManager](n))
	r.custody = authz.NewCache[*mwanachamacustody.CustodyManager]("custody", nil, authz.WithTTL[*mwanachamacustody.CustodyManager](0), authz.WithMaxEntries[*mwanachamacustody.CustodyManager](n))
	r.twins = authz.NewCache[mwanachamadigitaltwin.TwinManager]("twins", nil, authz.WithTTL[mwanachamadigitaltwin.TwinManager](0), authz.WithMaxEntries[mwanachamadigitaltwin.TwinManager](n))
	r.posts = authz.NewCache[mwanachamaengage.PostManager]("posts", nil, authz.WithTTL[mwanachamaengage.PostManager](0), authz.WithMaxEntries[mwanachamaengage.PostManager](n))
	r.risks = authz.NewCache[mwanachamariskmanager.RiskManager]("risks", nil, authz.WithTTL[mwanachamariskmanager.RiskManager](0), authz.WithMaxEntries[mwanachamariskmanager.RiskManager](n))
	r.markets = authz.NewCache[mwanachamamarket.MarketManager]("markets", nil, authz.WithTTL[mwanachamamarket.MarketManager](0), authz.WithMaxEntries[mwanachamamarket.MarketManager](n))
	r.approvals = authz.NewCache[*approvals.Store]("approvals", nil, authz.WithTTL[*approvals.Store](0), authz.WithMaxEntries[*approvals.Store](n))
	r.assets = authz.NewCache[mwanachamaassetmanager.AssetManager]("assets", nil, authz.WithTTL[mwanachamaassetmanager.AssetManager](0), authz.WithMaxEntries[mwanachamaassetmanager.AssetManager](n))
	r.directories = authz.NewCache[mwanachamaactor.UserManager]("directories", nil, authz.WithTTL[mwanachamaactor.UserManager](0), authz.WithMaxEntries[mwanachamaactor.UserManager](n))
	r.forms = authz.NewCache[mwanachamaforms.FormManager]("forms", nil, authz.WithTTL[mwanachamaforms.FormManager](0), authz.WithMaxEntries[mwanachamaforms.FormManager](n))
	r.rooms = authz.NewCache[*mwanachamacomm.CommManager]("rooms", nil, authz.WithTTL[*mwanachamacomm.CommManager](0), authz.WithMaxEntries[*mwanachamacomm.CommManager](n))
	r.standings = authz.NewCache[Standing]("standings", r.epochs, authz.WithMaxEntries[Standing](n))
	r.instances = authz.NewCache[Instance]("instances", r.epochs, authz.WithMaxEntries[Instance](n))
	r.adopted = authz.NewCache[bool]("adopted", r.epochs, authz.WithMaxEntries[bool](n))
}

func standingKey(instanceID, userID string) string { return instanceID + "\x00" + userID }

func standingDeps(instanceID, userID string) []string {
	return []string{authz.TenantKey(instanceID), authz.SubjectKey(userID)}
}

type standingRow struct {
	Role         string
	AgencyRoleID string
	ID           string
	Name         string
	TableSlug    string
	JoinMode     string
	Kind         string
	Listed       bool
	Purpose      string
	Place        string
	Audience     string
	Approval     string
	ApprovalNote string
	CreatedAt    time.Time
}

const standingColumns = "m.role AS role, m.agency_role_id AS agency_role_id, i.id AS id, i.name AS name, i.table_slug AS table_slug, " +
	"i.join_mode AS join_mode, i.kind AS kind, i.listed AS listed, i.purpose AS purpose, i.place AS place, i.audience AS audience, " +
	"i.approval AS approval, i.approval_note AS approval_note, i.created_at AS created_at"

func (r *registry) standingOf(ctx context.Context, instanceID, userID string) (Standing, error) {
	st, err := r.standings.Get(ctx, standingKey(instanceID, userID), func(ctx context.Context) (Standing, []string, error) {
		stamp := r.epochs.Stamp()
		st, err := r.readStanding(ctx, instanceID, userID)
		if err == nil && st.Member {
			r.instances.Put(instanceID, st.Instance, stamp, []string{authz.TenantKey(instanceID)})
		}
		return st, standingDeps(instanceID, userID), err
	})
	if err == nil && st.Member {
		dbpool.Bind(ctx, instanceID)
	}
	return st, err
}

func (r *registry) readStanding(ctx context.Context, instanceID, userID string) (Standing, error) {
	var rows []standingRow
	err := r.db.WithContext(ctx).Table("agency_instance_members AS m").
		Select(standingColumns).
		Joins("JOIN agency_instances AS i ON i.id = m.instance_id").
		Where("m.instance_id = ? AND m.user_id = ?", instanceID, userID).
		Limit(1).Scan(&rows).Error
	if err != nil {
		return Standing{}, err
	}
	if len(rows) == 0 {
		return Standing{}, nil
	}
	row := rows[0]
	return Standing{Member: true, Role: row.Role, AgencyRoleID: row.AgencyRoleID, Instance: row.instance()}, nil
}

func (row standingRow) instance() Instance {
	return rowToInstance(instanceRow{
		ID: row.ID, Name: row.Name, TableSlug: row.TableSlug, JoinMode: row.JoinMode, Kind: row.Kind, Listed: row.Listed,
		Purpose: row.Purpose, Place: row.Place, Audience: row.Audience, Approval: row.Approval, ApprovalNote: row.ApprovalNote,
		CreatedAt: row.CreatedAt,
	})
}

func blank(values ...string) bool {
	for _, v := range values {
		if strings.TrimSpace(v) == "" {
			return true
		}
	}
	return false
}

func (r *registry) AdoptCaller(ctx context.Context, instanceID, subject string) error {
	_, err := r.adopted.Get(ctx, standingKey(instanceID, subject), func(ctx context.Context) (bool, []string, error) {
		directory, err := r.ActorManager(ctx, instanceID)
		if err != nil {
			return false, nil, err
		}
		if _, err := directory.EnsureActor(ctx, subject); err != nil {
			return false, nil, err
		}
		return true, standingDeps(instanceID, subject), nil
	})
	return err
}

func (r *registry) tenantChanged(instanceID string) {
	r.epochs.Bump(authz.TenantKey(instanceID))
}
