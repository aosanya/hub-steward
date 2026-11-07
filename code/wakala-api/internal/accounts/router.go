package accounts

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"sync"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"

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

	"wakalaserver/internal/agencies"
	"wakalaserver/internal/approvals"
	"wakalaserver/internal/authz"
	"wakalaserver/internal/dbpool"
)

var TenantGate *dbpool.Gate

// Opener dials one account's database.
type Opener func(ctx context.Context, c Connection) (*gorm.DB, error)

func OpenPostgres(_ context.Context, c Connection) (*gorm.DB, error) {
	dsn, err := c.PostgresDSN()
	if err != nil {
		return nil, err
	}
	db, err := gorm.Open(postgres.Open(dsn), GormConfig())
	if err != nil {
		return nil, fmt.Errorf("could not reach the account database")
	}
	if sqlDB, err := db.DB(); err == nil {
		PoolFromEnv("WAKALA_ACCOUNT_DB", AccountPool, os.Getenv).Apply(sqlDB)
	}
	if TenantGate != nil {
		dbpool.Install(db, dbpool.Options{Gate: TenantGate})
	}
	return db, nil
}

type pooled struct {
	reg      agencies.Registry
	db       *gorm.DB
	lastUsed time.Time
}

// Resolver answers where one account's data lives. ok is false when the account
// has no database of its own and the shared registry should serve it. wakala-api
// keeps no store, so in a real boot this reads the website's database
// (internal/shopdb).
type Resolver func(ctx context.Context, accountID string) (conn Connection, ok bool, err error)

// Router is an agencies.Registry that answers from the calling account's own
// database when it has one, and from the shared registry otherwise. The
// account comes from the request context (WithID).
type Router struct {
	shared  agencies.Registry
	resolve Resolver
	open    Opener
	max     int
	options []agencies.Option

	epochs      *authz.Epochs
	resolutions *authz.Cache[bool]

	mu   sync.Mutex
	pool map[string]*pooled
}

func NewRouter(shared agencies.Registry, resolve Resolver, open Opener, max int, opts ...agencies.Option) *Router {
	if max < 1 {
		max = 32
	}
	epochs := authz.NewEpochs()
	if source, ok := shared.(agencies.EpochSource); ok && source.Epochs() != nil {
		epochs = source.Epochs()
	}
	options := append([]agencies.Option{agencies.WithEpochs(epochs)}, opts...)
	return &Router{
		shared: shared, resolve: resolve, open: open, max: max, options: options,
		epochs:      epochs,
		resolutions: authz.NewCache[bool]("resolutions", epochs),
		pool:        map[string]*pooled{},
	}
}

func (r *Router) Epochs() *authz.Epochs { return r.epochs }

func (r *Router) Forget(accountID string) {
	r.mu.Lock()
	r.drop(accountID)
	r.mu.Unlock()
	r.epochs.Bump(authz.SubjectKey(accountID))
}

func (r *Router) drop(accountID string) {
	if p, ok := r.pool[accountID]; ok {
		if sqlDB, err := p.db.DB(); err == nil {
			closeQuietly(sqlDB)
		}
		delete(r.pool, accountID)
	}
}

func closeQuietly(db *sql.DB) { _ = db.Close() }

func (r *Router) pick(ctx context.Context) (agencies.Registry, error) {
	id := IDFromContext(ctx)
	if id == "" {
		return r.shared, nil
	}
	if reg, ok := r.pooledFor(id); ok {
		return reg, nil
	}
	own, err := r.resolutions.Get(ctx, id, func(ctx context.Context) (bool, []string, error) {
		_, ok, err := r.resolve(ctx, id)
		return ok, []string{authz.SubjectKey(id)}, err
	})
	if err != nil {
		return nil, err
	}
	if !own {
		return r.shared, nil
	}
	return r.openFor(ctx, id)
}

func (r *Router) pooledFor(id string) (agencies.Registry, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	p, ok := r.pool[id]
	if !ok {
		return nil, false
	}
	p.lastUsed = time.Now()
	return p.reg, true
}

func (r *Router) openFor(ctx context.Context, id string) (agencies.Registry, error) {
	conn, ok, err := r.resolve(ctx, id)
	if err != nil {
		return nil, err
	}
	if !ok {
		return r.shared, nil
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if p, held := r.pool[id]; held {
		p.lastUsed = time.Now()
		return p.reg, nil
	}
	db, err := r.open(ctx, conn)
	if err != nil {
		return nil, err
	}
	reg, err := agencies.NewRegistry(db, append(append([]agencies.Option{}, r.options...), agencies.StartingApproved())...)
	if err != nil {
		return nil, err
	}
	if len(r.pool) >= r.max {
		oldest, when := "", time.Now().Add(time.Hour)
		for k, p := range r.pool {
			if p.lastUsed.Before(when) {
				oldest, when = k, p.lastUsed
			}
		}
		r.drop(oldest)
	}
	r.pool[id] = &pooled{reg: reg, db: db, lastUsed: time.Now()}
	return reg, nil
}

func (r *Router) AdoptCaller(ctx context.Context, instanceID, subject string) error {
	reg, err := r.pick(ctx)
	if err != nil {
		return err
	}
	adopter, ok := reg.(agencies.ActorAdopter)
	if !ok {
		directory, err := reg.ActorManager(ctx, instanceID)
		if err != nil {
			return err
		}
		_, err = directory.EnsureActor(ctx, subject)
		return err
	}
	return adopter.AdoptCaller(ctx, instanceID, subject)
}

func (r *Router) CreateInstance(ctx context.Context, name string) (agencies.Instance, error) {
	reg, err := r.pick(ctx)
	if err != nil {
		return agencies.Instance{}, err
	}
	return reg.CreateInstance(ctx, name)
}

func (r *Router) GetInstance(ctx context.Context, id string) (agencies.Instance, error) {
	reg, err := r.pick(ctx)
	if err != nil {
		return agencies.Instance{}, err
	}
	return reg.GetInstance(ctx, id)
}

func (r *Router) ListInstances(ctx context.Context) ([]agencies.Instance, error) {
	reg, err := r.pick(ctx)
	if err != nil {
		return nil, err
	}
	return reg.ListInstances(ctx)
}

func (r *Router) AgencyManager(ctx context.Context, id string) (mwanachamaagency.AgencyManager, error) {
	reg, err := r.pick(ctx)
	if err != nil {
		return nil, err
	}
	return reg.AgencyManager(ctx, id)
}

func (r *Router) LedgerRepository(ctx context.Context, id string) (mwanachamaaccounting.LedgerRepository, error) {
	reg, err := r.pick(ctx)
	if err != nil {
		return nil, err
	}
	return reg.LedgerRepository(ctx, id)
}

func (r *Router) TaskManager(ctx context.Context, id string) (mwanachamataskmanager.TaskManager, error) {
	reg, err := r.pick(ctx)
	if err != nil {
		return nil, err
	}
	return reg.TaskManager(ctx, id)
}

func (r *Router) CatalogManager(ctx context.Context, id, mount string) (mwanachamacatalog.CatalogManager, error) {
	reg, err := r.pick(ctx)
	if err != nil {
		return nil, err
	}
	return reg.CatalogManager(ctx, id, mount)
}

func (r *Router) GitManager(ctx context.Context, id string) (mwanachamagit.GitManager, error) {
	reg, err := r.pick(ctx)
	if err != nil {
		return nil, err
	}
	return reg.GitManager(ctx, id)
}

func (r *Router) SourceManager(ctx context.Context, id string) (mwanachamasources.SourceManager, error) {
	reg, err := r.pick(ctx)
	if err != nil {
		return nil, err
	}
	return reg.SourceManager(ctx, id)
}

func (r *Router) AssetManager(ctx context.Context, id string) (mwanachamaassetmanager.AssetManager, error) {
	reg, err := r.pick(ctx)
	if err != nil {
		return nil, err
	}
	return reg.AssetManager(ctx, id)
}

func (r *Router) ActorManager(ctx context.Context, id string) (mwanachamaactor.UserManager, error) {
	reg, err := r.pick(ctx)
	if err != nil {
		return nil, err
	}
	return reg.ActorManager(ctx, id)
}

func (r *Router) FormManager(ctx context.Context, id string) (mwanachamaforms.FormManager, error) {
	reg, err := r.pick(ctx)
	if err != nil {
		return nil, err
	}
	return reg.FormManager(ctx, id)
}

func (r *Router) IssuingFormManager(ctx context.Context, id string) (mwanachamaforms.FormManager, error) {
	reg, err := r.pick(ctx)
	if err != nil {
		return nil, err
	}
	return reg.IssuingFormManager(ctx, id)
}

func (r *Router) CommManager(ctx context.Context, id string) (*mwanachamacomm.CommManager, error) {
	reg, err := r.pick(ctx)
	if err != nil {
		return nil, err
	}
	return reg.CommManager(ctx, id)
}

func (r *Router) OpenGeneralThread(ctx context.Context, instanceID, structureID, callerID string) error {
	reg, err := r.pick(ctx)
	if err != nil {
		return err
	}
	return reg.OpenGeneralThread(ctx, instanceID, structureID, callerID)
}

func (r *Router) GeneralThreadID(ctx context.Context, instanceID, structureID, callerID string) (string, error) {
	reg, err := r.pick(ctx)
	if err != nil {
		return "", err
	}
	return reg.GeneralThreadID(ctx, instanceID, structureID, callerID)
}

func (r *Router) AddMember(ctx context.Context, instanceID, userID, role string) error {
	reg, err := r.pick(ctx)
	if err != nil {
		return err
	}
	return reg.AddMember(ctx, instanceID, userID, role)
}

func (r *Router) RemoveMember(ctx context.Context, instanceID, userID string) error {
	reg, err := r.pick(ctx)
	if err != nil {
		return err
	}
	return reg.RemoveMember(ctx, instanceID, userID)
}

func (r *Router) IsMember(ctx context.Context, instanceID, userID string) (bool, error) {
	reg, err := r.pick(ctx)
	if err != nil {
		return false, err
	}
	return reg.IsMember(ctx, instanceID, userID)
}

func (r *Router) InstancesFor(ctx context.Context, userID string) ([]agencies.Instance, error) {
	reg, err := r.pick(ctx)
	if err != nil {
		return nil, err
	}
	return reg.InstancesFor(ctx, userID)
}

func (r *Router) Members(ctx context.Context, instanceID string) ([]agencies.Member, error) {
	reg, err := r.pick(ctx)
	if err != nil {
		return nil, err
	}
	return reg.Members(ctx, instanceID)
}

func (r *Router) RoleOf(ctx context.Context, instanceID, userID string) (string, error) {
	reg, err := r.pick(ctx)
	if err != nil {
		return "", err
	}
	return reg.RoleOf(ctx, instanceID, userID)
}

func (r *Router) MembershipsFor(ctx context.Context, userID string) ([]agencies.Membership, error) {
	reg, err := r.pick(ctx)
	if err != nil {
		return nil, err
	}
	return reg.MembershipsFor(ctx, userID)
}

func (r *Router) SetJoinMode(ctx context.Context, instanceID, mode string) (agencies.Instance, error) {
	reg, err := r.pick(ctx)
	if err != nil {
		return agencies.Instance{}, err
	}
	return reg.SetJoinMode(ctx, instanceID, mode)
}

func (r *Router) RenameInstance(ctx context.Context, instanceID, name string) (agencies.Instance, error) {
	reg, err := r.pick(ctx)
	if err != nil {
		return agencies.Instance{}, err
	}
	return reg.RenameInstance(ctx, instanceID, name)
}

func (r *Router) SetKind(ctx context.Context, instanceID, kind string) (agencies.Instance, error) {
	reg, err := r.pick(ctx)
	if err != nil {
		return agencies.Instance{}, err
	}
	return reg.SetKind(ctx, instanceID, kind)
}

func (r *Router) Join(ctx context.Context, instanceID, userID, message string) (agencies.JoinOutcome, error) {
	reg, err := r.pick(ctx)
	if err != nil {
		return agencies.JoinOutcome{}, err
	}
	return reg.Join(ctx, instanceID, userID, message)
}

func (r *Router) Leave(ctx context.Context, instanceID, userID string) error {
	reg, err := r.pick(ctx)
	if err != nil {
		return err
	}
	return reg.Leave(ctx, instanceID, userID)
}

func (r *Router) JoinRequests(ctx context.Context, instanceID string) ([]agencies.JoinRequest, error) {
	reg, err := r.pick(ctx)
	if err != nil {
		return nil, err
	}
	return reg.JoinRequests(ctx, instanceID)
}

func (r *Router) DecideJoinRequest(ctx context.Context, instanceID, userID string, approve bool) error {
	reg, err := r.pick(ctx)
	if err != nil {
		return err
	}
	return reg.DecideJoinRequest(ctx, instanceID, userID, approve)
}

func (r *Router) HasPendingJoinRequest(ctx context.Context, instanceID, userID string) (bool, error) {
	reg, err := r.pick(ctx)
	if err != nil {
		return false, err
	}
	return reg.HasPendingJoinRequest(ctx, instanceID, userID)
}

func (r *Router) AdmitResident(ctx context.Context, instanceID, userID string) (string, error) {
	reg, err := r.pick(ctx)
	if err != nil {
		return "", err
	}
	return reg.AdmitResident(ctx, instanceID, userID)
}

func (r *Router) SetListing(ctx context.Context, instanceID string, change agencies.ListingChange) (agencies.Instance, error) {
	reg, err := r.pick(ctx)
	if err != nil {
		return agencies.Instance{}, err
	}
	return reg.SetListing(ctx, instanceID, change)
}

func (r *Router) SearchDirectory(ctx context.Context, query string) ([]agencies.DirectoryEntry, error) {
	reg, err := r.pick(ctx)
	if err != nil {
		return nil, err
	}
	return reg.SearchDirectory(ctx, query)
}

func (r *Router) Approvals(ctx context.Context, id string) (*approvals.Store, error) {
	reg, err := r.pick(ctx)
	if err != nil {
		return nil, err
	}
	return reg.Approvals(ctx, id)
}

func (r *Router) CustodyManager(ctx context.Context, id string) (*mwanachamacustody.CustodyManager, error) {
	reg, err := r.pick(ctx)
	if err != nil {
		return nil, err
	}
	return reg.CustodyManager(ctx, id)
}

func (r *Router) TwinManager(ctx context.Context, id string) (mwanachamadigitaltwin.TwinManager, error) {
	reg, err := r.pick(ctx)
	if err != nil {
		return nil, err
	}
	return reg.TwinManager(ctx, id)
}

func (r *Router) PostManager(ctx context.Context, id string) (mwanachamaengage.PostManager, error) {
	reg, err := r.pick(ctx)
	if err != nil {
		return nil, err
	}
	return reg.PostManager(ctx, id)
}

func (r *Router) PollManager(ctx context.Context, id string) (mwanachamavoting.PollManager, error) {
	reg, err := r.pick(ctx)
	if err != nil {
		return nil, err
	}
	return reg.PollManager(ctx, id)
}

func (r *Router) RiskManager(ctx context.Context, id string) (mwanachamariskmanager.RiskManager, error) {
	reg, err := r.pick(ctx)
	if err != nil {
		return nil, err
	}
	return reg.RiskManager(ctx, id)
}

func (r *Router) RemoveFromAgency(ctx context.Context, instanceID, userID, removedBy string) (agencies.Removal, error) {
	reg, err := r.pick(ctx)
	if err != nil {
		return agencies.Removal{}, err
	}
	removals, ok := reg.(agencies.RemovalRegistry)
	if !ok {
		return agencies.Removal{}, errRemovalsUnsupported
	}
	return removals.RemoveFromAgency(ctx, instanceID, userID, removedBy)
}

func (r *Router) RemovalsFor(ctx context.Context, userID string) ([]agencies.Removal, error) {
	reg, err := r.pick(ctx)
	if err != nil {
		return nil, err
	}
	removals, ok := reg.(agencies.RemovalRegistry)
	if !ok {
		return nil, errRemovalsUnsupported
	}
	return removals.RemovalsFor(ctx, userID)
}

var errRemovalsUnsupported = errors.New("this register keeps no removals")

func (r *Router) SetAgencyRole(ctx context.Context, instanceID, userID, agencyRoleID string) error {
	reg, err := r.pick(ctx)
	if err != nil {
		return err
	}
	links, ok := reg.(agencies.AgencyRoleLinks)
	if !ok {
		return agencies.ErrNotAMember
	}
	return links.SetAgencyRole(ctx, instanceID, userID, agencyRoleID)
}

func (r *Router) GrantAgentRole(ctx context.Context, instanceID, userID, agencyRoleID string) error {
	reg, err := r.pick(ctx)
	if err != nil {
		return err
	}
	grants, ok := reg.(agencies.AgentGrants)
	if !ok {
		return agencies.ErrNotAMember
	}
	return grants.GrantAgentRole(ctx, instanceID, userID, agencyRoleID)
}

func (r *Router) AgencyRoleOf(ctx context.Context, instanceID, userID string) (string, error) {
	reg, err := r.pick(ctx)
	if err != nil {
		return "", err
	}
	links, ok := reg.(agencies.AgencyRoleLinks)
	if !ok {
		return "", nil
	}
	return links.AgencyRoleOf(ctx, instanceID, userID)
}

func (r *Router) MarketManager(ctx context.Context, id, mount string) (mwanachamamarket.MarketManager, error) {
	reg, err := r.pick(ctx)
	if err != nil {
		return nil, err
	}
	return reg.MarketManager(ctx, id, mount)
}

func (r *Router) TestCopy(ctx context.Context, id string) (agencies.TestCopy, error) {
	reg, err := r.pick(ctx)
	if err != nil {
		return agencies.TestCopy{}, err
	}
	return reg.TestCopy(ctx, id)
}
