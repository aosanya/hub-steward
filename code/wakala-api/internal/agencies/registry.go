// Package agencies is wakala-api's own layer for managing multiple
// Agencies. mwanachama-backend-agency is imported unmodified (decision #1)
// and is single-Agency-per-table-set by design — its AgencyManager.GetAgency
// takes no id and its own doc comment says it "fetches the sole Agency row
// (single-agency deployment)". Registry is what lets more than one Agency
// exist in this product: every registered Instance gets its own private
// table set via mwanachamaagency.SpecFor(TableSlug), so N Instances means N
// agencies coexisting, unmodified, in the one shared Postgres database
// (decision #14, and decision #21 for the membership that fences them).
package agencies

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"
	"wakalaserver/internal/approvals"
	"wakalaserver/internal/notifyrules"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"wakalaserver/internal/authz"

	mwanachamaaccounting "wakalaserver/modules/accounting"
	mwanachamaactor "wakalaserver/modules/actor"
	mwanachamaagency "wakalaserver/modules/agency"
	mwanachamaassetmanager "wakalaserver/modules/assetmanager"
	mwanachamacatalog "wakalaserver/modules/catalog"
	mwanachamacomm "wakalaserver/modules/comm"
	commmodels "wakalaserver/modules/comm/models"
	mwanachamacustody "wakalaserver/modules/custody"
	mwanachamadigitaltwin "wakalaserver/modules/digitaltwin"
	mwanachamaengage "wakalaserver/modules/engage"
	mwanachamaforms "wakalaserver/modules/forms"
	mwanachamagit "wakalaserver/modules/git"
	mwanachamamarket "wakalaserver/modules/market"
	mwanachamaratings "wakalaserver/modules/ratings"
	mwanachamariskmanager "wakalaserver/modules/riskmanager"
	mwanachamasources "wakalaserver/modules/sources"
	mwanachamataskmanager "wakalaserver/modules/taskmanager"
	mwanachamavoting "wakalaserver/modules/voting"
)

type Instance struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	TableSlug    string    `json:"table_slug"`
	JoinMode     string    `json:"join_mode"`
	Kind         string    `json:"kind"`
	Listed       bool      `json:"listed"`
	Purpose      string    `json:"purpose"`
	Place        string    `json:"place"`
	Audience     string    `json:"audience"`
	Approval     string    `json:"approval"`
	ApprovalNote string    `json:"approval_note"`
	CreatedAt    time.Time `json:"created_at"`
}

var ErrInstanceNotFound = errors.New("agencies: instance not found")

type Registry interface {
	CreateInstance(ctx context.Context, name string) (Instance, error)
	GetInstance(ctx context.Context, id string) (Instance, error)
	ListInstances(ctx context.Context) ([]Instance, error)
	AgencyManager(ctx context.Context, id string) (mwanachamaagency.AgencyManager, error)
	LedgerRepository(ctx context.Context, id string) (mwanachamaaccounting.LedgerRepository, error)
	TaskManager(ctx context.Context, id string) (mwanachamataskmanager.TaskManager, error)
	CatalogManager(ctx context.Context, id, mount string) (mwanachamacatalog.CatalogManager, error)
	RatingsManager(ctx context.Context, id string) (mwanachamaratings.RatingsManager, error)
	GitManager(ctx context.Context, id string) (mwanachamagit.GitManager, error)
	SourceManager(ctx context.Context, id string) (mwanachamasources.SourceManager, error)
	PollManager(ctx context.Context, id string) (mwanachamavoting.PollManager, error)
	CustodyManager(ctx context.Context, id string) (*mwanachamacustody.CustodyManager, error)
	TwinManager(ctx context.Context, id string) (mwanachamadigitaltwin.TwinManager, error)
	PostManager(ctx context.Context, id string) (mwanachamaengage.PostManager, error)
	RiskManager(ctx context.Context, id string) (mwanachamariskmanager.RiskManager, error)
	MarketManager(ctx context.Context, id, mount string) (mwanachamamarket.MarketManager, error)
	TestCopy(ctx context.Context, id string) (TestCopy, error)
	Approvals(ctx context.Context, id string) (*approvals.Store, error)
	AssetManager(ctx context.Context, id string) (mwanachamaassetmanager.AssetManager, error)
	ActorManager(ctx context.Context, id string) (mwanachamaactor.UserManager, error)

	FormManager(ctx context.Context, id string) (mwanachamaforms.FormManager, error)
	IssuingFormManager(ctx context.Context, id string) (mwanachamaforms.FormManager, error)
	CommManager(ctx context.Context, id string) (*mwanachamacomm.CommManager, error)
	OpenGeneralThread(ctx context.Context, instanceID, structureID, callerID string) error
	GeneralThreadID(ctx context.Context, instanceID, structureID, callerID string) (string, error)

	AddMember(ctx context.Context, instanceID, userID, role string) error
	RemoveMember(ctx context.Context, instanceID, userID string) error
	IsMember(ctx context.Context, instanceID, userID string) (bool, error)
	RoleOf(ctx context.Context, instanceID, userID string) (string, error)
	InstancesFor(ctx context.Context, userID string) ([]Instance, error)
	MembershipsFor(ctx context.Context, userID string) ([]Membership, error)
	Members(ctx context.Context, instanceID string) ([]Member, error)

	SetJoinMode(ctx context.Context, instanceID, mode string) (Instance, error)
	RenameInstance(ctx context.Context, instanceID, name string) (Instance, error)
	SetKind(ctx context.Context, instanceID, kind string) (Instance, error)
	SetListing(ctx context.Context, instanceID string, change ListingChange) (Instance, error)
	SearchDirectory(ctx context.Context, query string) ([]DirectoryEntry, error)
	Join(ctx context.Context, instanceID, userID, message string) (JoinOutcome, error)
	Leave(ctx context.Context, instanceID, userID string) error
	JoinRequests(ctx context.Context, instanceID string) ([]JoinRequest, error)
	DecideJoinRequest(ctx context.Context, instanceID, userID string, approve bool) error
	HasPendingJoinRequest(ctx context.Context, instanceID, userID string) (bool, error)
	AdmitResident(ctx context.Context, instanceID, userID string) (string, error)
}

type registry struct {
	db *gorm.DB

	outcomes *promiseOutcomes

	epochs          *authz.Epochs
	cacheEntries    int
	managers        *authz.Cache[mwanachamaagency.AgencyManager]
	ledgers         *authz.Cache[mwanachamaaccounting.LedgerRepository]
	boards          *authz.Cache[mwanachamataskmanager.TaskManager]
	catalogs        *authz.Cache[mwanachamacatalog.CatalogManager]
	gits            *authz.Cache[mwanachamagit.GitManager]
	sources         *authz.Cache[mwanachamasources.SourceManager]
	polls           *authz.Cache[mwanachamavoting.PollManager]
	custody         *authz.Cache[*mwanachamacustody.CustodyManager]
	twins           *authz.Cache[mwanachamadigitaltwin.TwinManager]
	posts           *authz.Cache[mwanachamaengage.PostManager]
	risks           *authz.Cache[mwanachamariskmanager.RiskManager]
	markets         *authz.Cache[mwanachamamarket.MarketManager]
	approvals       *authz.Cache[*approvals.Store]
	assets          *authz.Cache[mwanachamaassetmanager.AssetManager]
	directories     *authz.Cache[mwanachamaactor.UserManager]
	forms           *authz.Cache[mwanachamaforms.FormManager]
	rooms           *authz.Cache[*mwanachamacomm.CommManager]
	standings       *authz.Cache[Standing]
	instances       *authz.Cache[Instance]
	adopted         *authz.Cache[bool]
	formsApproval   FormsApprovalOf
	consentRequired ConsentRequiredOf
	moduleMounted   ModuleMountedOf

	withdrawalPolicy WithdrawalPolicy
	recordGrants     RecordGrantOf

	actorOptions []mwanachamaactor.Option
	pushSender   mwanachamacomm.PushSender
	pushFailed   func(error)
	mutability   Mutability
	rules        RuleOf
	startsAs     string

	scenariosAtOnce ScenariosAtOnce
	tokensPerTest   TokensPerTest
	runnerOf        RunnerOf
	resumes         resumes
}

type Mutability func(ctx context.Context, instanceID string, event commmodels.NotificationEvent) (mutable bool, known bool)

type RuleOf func(ctx context.Context, instanceID string, e notifyrules.Event) (notifyrules.Rule, error)

func WithRules(rules RuleOf) Option {
	return func(r *registry) { r.rules = rules }
}

func WithMutability(m Mutability) Option {
	return func(r *registry) { r.mutability = m }
}

type Option func(*registry)

type FormsApprovalOf func(ctx context.Context, instanceID string) (bool, error)

type RecordGrantOf func(ctx context.Context, instanceID, actorID, module, object, id, action string) (bool, error)

func WithRecordGrants(of RecordGrantOf) Option {
	return func(r *registry) { r.recordGrants = of }
}

func WithFormsApproval(of FormsApprovalOf) Option {
	return func(r *registry) { r.formsApproval = of }
}

func WithInvitationLifetime(d time.Duration) Option {
	return func(r *registry) {
		r.actorOptions = append(r.actorOptions, mwanachamaactor.WithInvitationLifetime(d))
	}
}

func WithWebPush(sender mwanachamacomm.PushSender, onFailure func(error)) Option {
	return func(r *registry) {
		r.pushSender = sender
		r.pushFailed = onFailure
	}
}

func NewRegistry(db *gorm.DB, opts ...Option) (Registry, error) {
	if db == nil {
		return nil, fmt.Errorf("NewRegistry: db must not be nil")
	}
	if err := db.AutoMigrate(&instanceRow{}); err != nil {
		return nil, fmt.Errorf("NewRegistry: migrate: %w", err)
	}
	if err := migrateMembers(db); err != nil {
		return nil, fmt.Errorf("NewRegistry: migrate members: %w", err)
	}
	if err := migratePromiseOutcomes(db); err != nil {
		return nil, fmt.Errorf("NewRegistry: migrate promise outcomes: %w", err)
	}
	if err := migrateGroupRoles(db); err != nil {
		return nil, fmt.Errorf("NewRegistry: migrate group roles: %w", err)
	}
	r := &registry{db: db, outcomes: newPromiseOutcomes(db), cacheEntries: authz.DefaultMaxEntries, withdrawalPolicy: WithdrawalKeepsHidden}
	for _, opt := range opts {
		opt(r)
	}
	if r.epochs == nil {
		r.epochs = authz.NewEpochs()
	}
	r.openCaches()
	return r, nil
}

// tableSlug mints the instance segment of every physical name this
// instance's tables take: <slug>_agency_<table>. It carries no underscore
// and stays short, because the segment is read back apart by the separator
// and every emitted index name has to fit Postgres's 63-byte identifier
// limit, which truncates silently rather than failing.
func tableSlug() string {
	return "agy" + strings.ReplaceAll(uuid.New().String(), "-", "")[:8]
}

func (r *registry) CreateInstance(ctx context.Context, name string) (Instance, error) {
	if name == "" {
		return Instance{}, fmt.Errorf("CreateInstance: name must not be empty")
	}
	row := instanceRow{
		ID:        uuid.New().String(),
		Name:      name,
		TableSlug: tableSlug(),
		JoinMode:  JoinConfirmed,
		Approval:  r.startingApproval(),
		CreatedAt: time.Now().UTC(),
	}
	if err := r.db.WithContext(ctx).Create(&row).Error; err != nil {
		return Instance{}, fmt.Errorf("CreateInstance: %w", err)
	}
	return rowToInstance(row), nil
}

func (r *registry) GetInstance(ctx context.Context, id string) (Instance, error) {
	return r.instances.Get(ctx, id, func(ctx context.Context) (Instance, []string, error) {
		inst, err := r.readInstance(ctx, id)
		return inst, []string{authz.TenantKey(id)}, err
	})
}

func (r *registry) readInstance(ctx context.Context, id string) (Instance, error) {
	var row instanceRow
	err := r.db.WithContext(ctx).First(&row, "id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return Instance{}, ErrInstanceNotFound
	}
	if err != nil {
		return Instance{}, fmt.Errorf("GetInstance: %w", err)
	}
	return rowToInstance(row), nil
}

func (r *registry) ListInstances(ctx context.Context) ([]Instance, error) {
	var rows []instanceRow
	if err := r.db.WithContext(ctx).Order("created_at").Find(&rows).Error; err != nil {
		return nil, fmt.Errorf("ListInstances: %w", err)
	}
	out := make([]Instance, len(rows))
	for i, row := range rows {
		out[i] = rowToInstance(row)
	}
	return out, nil
}

func (r *registry) AgencyManager(ctx context.Context, id string) (mwanachamaagency.AgencyManager, error) {
	manager, err := pooled(ctx, r.managers, id, r.buildAgencyManager)
	if err != nil {
		return nil, err
	}
	if err := r.resumes.once(id, func() error {
		_, err := manager.ResumeRuns(ctx)
		return err
	}); err != nil {
		return nil, fmt.Errorf("AgencyManager: resume runs of instance %s: %w", id, err)
	}
	return manager, nil
}

func (r *registry) buildAgencyManager(ctx context.Context, id string) (mwanachamaagency.AgencyManager, error) {
	inst, err := r.GetInstance(ctx, id)
	if err != nil {
		return nil, err
	}
	s, err := mwanachamaagency.SpecFor(inst.TableSlug)
	if err != nil {
		return nil, fmt.Errorf("AgencyManager: spec for instance %s: %w", id, err)
	}
	if err := mwanachamaagency.Provision(r.db, s); err != nil {
		return nil, fmt.Errorf("AgencyManager: migrate instance %s: %w", id, err)
	}
	if _, err := r.ActorManager(ctx, id); err != nil {
		return nil, fmt.Errorf("AgencyManager: directory of instance %s: %w", id, err)
	}
	built, err := mwanachamaagency.NewAgencyManager(r.db, s, r.agencyOptions(id)...)
	if err != nil {
		return nil, err
	}
	return roleEdits{AgencyManager: built, changed: func() { r.tenantChanged(id) }}, nil
}

func (r *registry) agencyOptions(id string) []mwanachamaagency.Option {
	opts := []mwanachamaagency.Option{mwanachamaagency.WithGroupLister(r.pickerGroups(id)), mwanachamaagency.WithRunLister(r.runsUnderWay(id)), mwanachamaagency.WithReviewAreas(r.reviewAreasOf(id))}
	if r.runnerOf != nil {
		opts = append(opts, mwanachamaagency.WithScenarioRunner(r.runnerOf(id)))
	}
	if r.scenariosAtOnce != nil {
		opts = append(opts, mwanachamaagency.WithScenariosAtOnce(r.scenarioLimit(id)))
	}
	if r.tokensPerTest != nil {
		opts = append(opts, mwanachamaagency.WithTokensPerTest(r.tokenLimit(id)))
	}
	return opts
}

func (r *registry) scenarioLimit(id string) func(ctx context.Context) int {
	return func(ctx context.Context) int {
		n, err := r.scenariosAtOnce(ctx, id)
		if err != nil {
			return 1
		}
		return n
	}
}

func (r *registry) LedgerRepository(ctx context.Context, id string) (mwanachamaaccounting.LedgerRepository, error) {
	return pooled(ctx, r.ledgers, id, r.buildLedgerRepository)
}

func (r *registry) buildLedgerRepository(ctx context.Context, id string) (mwanachamaaccounting.LedgerRepository, error) {
	inst, err := r.GetInstance(ctx, id)
	if err != nil {
		return nil, err
	}
	s, err := mwanachamaaccounting.SpecFor(inst.TableSlug)
	if err != nil {
		return nil, fmt.Errorf("LedgerRepository: spec for instance %s: %w", id, err)
	}
	if err := mwanachamaaccounting.Provision(r.db, s); err != nil {
		return nil, fmt.Errorf("LedgerRepository: migrate instance %s: %w", id, err)
	}
	built, err := mwanachamaaccounting.NewLedgerRepository(r.db, s)
	if err != nil {
		return nil, err
	}

	return built, nil
}

func (r *registry) TaskManager(ctx context.Context, id string) (mwanachamataskmanager.TaskManager, error) {
	return pooled(ctx, r.boards, id, r.buildTaskManager)
}

func (r *registry) buildTaskManager(ctx context.Context, id string) (mwanachamataskmanager.TaskManager, error) {
	inst, err := r.GetInstance(ctx, id)
	if err != nil {
		return nil, err
	}
	s, err := mwanachamataskmanager.SpecForMount(inst.TableSlug, MountBoard)
	if err != nil {
		return nil, fmt.Errorf("TaskManager: spec for instance %s: %w", id, err)
	}
	if err := mwanachamataskmanager.Provision(r.db, s); err != nil {
		return nil, fmt.Errorf("TaskManager: migrate instance %s: %w", id, err)
	}
	var built mwanachamataskmanager.TaskManager
	notices := &caseNotices{rooms: r.CommManager, board: func() mwanachamataskmanager.TaskManager { return built }, instanceID: id}
	built, err = mwanachamataskmanager.NewTaskManager(r.db, s, notices)
	if err != nil {
		return nil, err
	}
	backfillIssueCodes(ctx, built, id)
	built.UseGroups(mwanachamataskmanager.Groups(r.groupsIn(id)))
	built.UseGroupExists(r.groupExistsIn(id))
	built.UseInstanceOwner(r.ownerIn(id))
	built.UseRoleSync(r.backlogRolesIn(id))
	built = limitedBoard{TaskManager: built, publications: func(ctx context.Context) (publicationReader, error) {
		return r.AgencyManager(ctx, id)
	}, outcomes: r.outcomes}

	return built, nil
}

func (r *registry) SourceManager(ctx context.Context, id string) (mwanachamasources.SourceManager, error) {
	return pooled(ctx, r.sources, id, r.buildSourceManager)
}

func (r *registry) buildSourceManager(ctx context.Context, id string) (mwanachamasources.SourceManager, error) {
	inst, err := r.GetInstance(ctx, id)
	if err != nil {
		return nil, err
	}
	s, err := mwanachamasources.SpecForMount(inst.TableSlug, MountSources)
	if err != nil {
		return nil, fmt.Errorf("SourceManager: spec for instance %s: %w", id, err)
	}
	if err := mwanachamasources.Provision(r.db, s); err != nil {
		return nil, fmt.Errorf("SourceManager: migrate instance %s: %w", id, err)
	}
	built, err := mwanachamasources.NewSourceManager(r.db, s)
	if err != nil {
		return nil, err
	}

	return built, nil
}

func (r *registry) AssetManager(ctx context.Context, id string) (mwanachamaassetmanager.AssetManager, error) {
	return pooled(ctx, r.assets, id, r.buildAssetManager)
}

func (r *registry) buildAssetManager(ctx context.Context, id string) (mwanachamaassetmanager.AssetManager, error) {
	inst, err := r.GetInstance(ctx, id)
	if err != nil {
		return nil, err
	}
	s, err := assetManagerSpec(inst.TableSlug, MountAssets)
	if err != nil {
		return nil, fmt.Errorf("AssetManager: spec for instance %s: %w", id, err)
	}
	if err := mwanachamaassetmanager.Provision(r.db, s); err != nil {
		return nil, fmt.Errorf("AssetManager: migrate instance %s: %w", id, err)
	}
	built, err := mwanachamaassetmanager.NewAssetManager(r.db, s)
	if err != nil {
		return nil, err
	}

	return built, nil
}

func (r *registry) ActorManager(ctx context.Context, id string) (mwanachamaactor.UserManager, error) {
	return pooled(ctx, r.directories, id, r.buildActorManager)
}

func (r *registry) buildActorManager(ctx context.Context, id string) (mwanachamaactor.UserManager, error) {
	inst, err := r.GetInstance(ctx, id)
	if err != nil {
		return nil, err
	}
	s, err := mwanachamaactor.SpecForMount(inst.TableSlug, MountDirectory)
	if err != nil {
		return nil, fmt.Errorf("ActorManager: spec for instance %s: %w", id, err)
	}
	if err := mwanachamaactor.Provision(r.db, s); err != nil {
		return nil, fmt.Errorf("ActorManager: provision instance %s: %w", id, err)
	}
	built, err := mwanachamaactor.NewUserManager(r.db, s, r.actorOptions...)
	if err != nil {
		return nil, err
	}

	return built, nil
}

func (r *registry) FormManager(ctx context.Context, id string) (mwanachamaforms.FormManager, error) {
	return pooled(ctx, r.forms, id, r.buildFormManager)
}

func (r *registry) buildFormManager(ctx context.Context, id string) (mwanachamaforms.FormManager, error) {
	inst, err := r.GetInstance(ctx, id)
	if err != nil {
		return nil, err
	}
	s, err := mwanachamaforms.SpecFor(inst.TableSlug)
	if err != nil {
		return nil, fmt.Errorf("FormManager: spec for instance %s: %w", id, err)
	}
	if err := mwanachamaforms.Provision(r.db, s); err != nil {
		return nil, fmt.Errorf("FormManager: provision instance %s: %w", id, err)
	}
	r.hideEarlierWithdrawals(ctx, id, s)
	built, err := mwanachamaforms.NewFormManager(r.db, s)
	if err != nil {
		return nil, err
	}
	built.UseGroups(r.groupsIn(id))
	built.UseConsentGate(r.consentGateIn(id))
	built.UseStandingAudience(r.standingAudienceIn(id))
	built.UseNames(r.namesIn(id))
	built.UseMembers(r.membersIn(id))
	built.UseDeclarable(r.declarableIn(id))
	built.UseApprovalLimits(r.approvalLimitsIn(id))
	built.UseRecordWriters(r.recordWritersIn(id))
	if r.formsApproval != nil {
		required, err := r.formsApproval(ctx, id)
		if err != nil {
			return nil, fmt.Errorf("FormManager: approval setting for instance %s: %w", id, err)
		}
		built.UseApprovalRequired(required)
	}
	return built, nil
}

func (r *registry) IssuingFormManager(ctx context.Context, id string) (mwanachamaforms.FormManager, error) {
	if held, ok := r.forms.Peek(id); ok {
		return held, nil
	}
	inst, err := r.GetInstance(ctx, id)
	if err != nil {
		return nil, err
	}
	provisioned, err := formsProvisioned(r.db, inst.TableSlug)
	if err != nil {
		return nil, err
	}
	if !provisioned {
		return nil, ErrInstanceNotFound
	}
	return r.FormManager(ctx, id)
}

func formsProvisioned(db *gorm.DB, slug string) (bool, error) {
	s, err := mwanachamaforms.SpecFor(slug)
	if err != nil {
		return false, fmt.Errorf("IssuingFormManager: spec for slug %s: %w", slug, err)
	}
	links, ok := s.ByRole("public_link")
	if !ok {
		return false, fmt.Errorf("IssuingFormManager: the forms spec declares no public_link")
	}
	return db.Migrator().HasTable(s.TableFor(links)), nil
}

func (r *registry) CommManager(ctx context.Context, id string) (*mwanachamacomm.CommManager, error) {
	return pooled(ctx, r.rooms, id, r.buildCommManager)
}

func (r *registry) buildCommManager(ctx context.Context, id string) (*mwanachamacomm.CommManager, error) {
	inst, err := r.GetInstance(ctx, id)
	if err != nil {
		return nil, err
	}
	s, err := mwanachamacomm.SpecFor(inst.TableSlug)
	if err != nil {
		return nil, fmt.Errorf("CommManager: spec for instance %s: %w", id, err)
	}
	if err := mwanachamacomm.Provision(r.db, s); err != nil {
		return nil, fmt.Errorf("CommManager: provision instance %s: %w", id, err)
	}
	built, err := mwanachamacomm.NewCommManager(r.db, s, nil, RefusingActLog{}, "")
	if err != nil {
		return nil, err
	}
	built.UseBelonging(r.belongingIn(id))
	built.UseConsentGate(r.consentGateIn(id))
	built.UseLeading(r.leadingIn(id))
	built.UseRoomsOf(r.roomsOfIn(id))
	built.UseLeads(r.roomLeadsIn(id))
	built.UseRecipients(r.roomRecipientsIn(id))
	built.UseStanding(r.subjectStandingIn(id))
	built.UseAnswerers(r.subjectAnswerersIn(id))
	built.UseAuthorKindOf(r.authorKindIn(id))
	built.UseWebPush(r.pushSender, r.pushFailed)
	if r.mutability != nil {
		built.UseMutable(r.mutableIn(id))
	}

	return built, nil
}

func (r *registry) Approvals(ctx context.Context, id string) (*approvals.Store, error) {
	return pooled(ctx, r.approvals, id, r.buildApprovals)
}

func (r *registry) buildApprovals(ctx context.Context, id string) (*approvals.Store, error) {
	inst, err := r.GetInstance(ctx, id)
	if err != nil {
		return nil, err
	}
	built, err := approvals.Open(r.db, inst.TableSlug)
	if err != nil {
		return nil, fmt.Errorf("Approvals: migrate instance %s: %w", id, err)
	}
	return built, nil
}

func (r *registry) mutableIn(instanceID string) mwanachamacomm.Mutable {
	return func(ctx context.Context, event commmodels.NotificationEvent) (bool, bool) {
		return r.mutability(ctx, instanceID, event)
	}
}

func (r *registry) CustodyManager(ctx context.Context, id string) (*mwanachamacustody.CustodyManager, error) {
	return pooled(ctx, r.custody, id, r.buildCustodyManager)
}

func (r *registry) buildCustodyManager(ctx context.Context, id string) (*mwanachamacustody.CustodyManager, error) {
	inst, err := r.GetInstance(ctx, id)
	if err != nil {
		return nil, err
	}
	s, err := mwanachamacustody.SpecForMount(inst.TableSlug, MountCustody)
	if err != nil {
		return nil, fmt.Errorf("CustodyManager: spec for instance %s: %w", id, err)
	}
	if err := mwanachamacustody.Provision(r.db, s); err != nil {
		return nil, fmt.Errorf("CustodyManager: migrate instance %s: %w", id, err)
	}
	built, err := mwanachamacustody.NewCustodyManager(r.db, s, mwanachamacustody.SystemClock, nil)
	if err != nil {
		return nil, err
	}
	r.subscribeWithdrawals(built.ConsentGate(), id)
	return built, nil
}

func (r *registry) TwinManager(ctx context.Context, id string) (mwanachamadigitaltwin.TwinManager, error) {
	return pooled(ctx, r.twins, id, r.buildTwinManager)
}

func (r *registry) buildTwinManager(ctx context.Context, id string) (mwanachamadigitaltwin.TwinManager, error) {
	inst, err := r.GetInstance(ctx, id)
	if err != nil {
		return nil, err
	}
	s, err := mwanachamadigitaltwin.SpecForMount(inst.TableSlug, MountTwin)
	if err != nil {
		return nil, fmt.Errorf("TwinManager: spec for instance %s: %w", id, err)
	}
	if err := mwanachamadigitaltwin.Provision(r.db, s); err != nil {
		return nil, fmt.Errorf("TwinManager: migrate instance %s: %w", id, err)
	}
	return mwanachamadigitaltwin.NewTwinManager(r.db, s)
}

func (r *registry) PostManager(ctx context.Context, id string) (mwanachamaengage.PostManager, error) {
	return pooled(ctx, r.posts, id, r.buildPostManager)
}

func (r *registry) buildPostManager(ctx context.Context, id string) (mwanachamaengage.PostManager, error) {
	inst, err := r.GetInstance(ctx, id)
	if err != nil {
		return nil, err
	}
	s, err := mwanachamaengage.SpecForMount(inst.TableSlug, MountPosts)
	if err != nil {
		return nil, fmt.Errorf("PostManager: spec for instance %s: %w", id, err)
	}
	if err := mwanachamaengage.Provision(r.db, s); err != nil {
		return nil, fmt.Errorf("PostManager: migrate instance %s: %w", id, err)
	}
	built, err := mwanachamaengage.NewPostManager(r.db, s)
	if err != nil {
		return nil, err
	}
	built.UseGroups(mwanachamaengage.Groups(r.groupsIn(id)))
	built.UseGroupExists(mwanachamaengage.GroupExists(r.groupExistsIn(id)))
	built.UseConsentGate(r.consentGateIn(id))
	return built, nil
}

func (r *registry) PollManager(ctx context.Context, id string) (mwanachamavoting.PollManager, error) {
	return pooled(ctx, r.polls, id, r.buildPollManager)
}

func (r *registry) buildPollManager(ctx context.Context, id string) (mwanachamavoting.PollManager, error) {
	inst, err := r.GetInstance(ctx, id)
	if err != nil {
		return nil, err
	}
	s, err := mwanachamavoting.SpecForMount(inst.TableSlug, MountPolls)
	if err != nil {
		return nil, fmt.Errorf("PollManager: spec for instance %s: %w", id, err)
	}
	if err := mwanachamavoting.Provision(r.db, s); err != nil {
		return nil, fmt.Errorf("PollManager: migrate instance %s: %w", id, err)
	}
	built, err := mwanachamavoting.NewPollManager(r.db, s)
	if err != nil {
		return nil, err
	}
	built.UseGroups(mwanachamavoting.Groups(r.groupsIn(id)))
	built.UseGroupExists(mwanachamavoting.GroupExists(r.groupExistsIn(id)))
	return built, nil
}

func (r *registry) RiskManager(ctx context.Context, id string) (mwanachamariskmanager.RiskManager, error) {
	return pooled(ctx, r.risks, id, r.buildRiskManager)
}

func (r *registry) buildRiskManager(ctx context.Context, id string) (mwanachamariskmanager.RiskManager, error) {
	inst, err := r.GetInstance(ctx, id)
	if err != nil {
		return nil, err
	}
	s, err := mwanachamariskmanager.SpecForMount(inst.TableSlug, MountRisks)
	if err != nil {
		return nil, fmt.Errorf("RiskManager: spec for instance %s: %w", id, err)
	}
	if err := mwanachamariskmanager.Provision(r.db, s); err != nil {
		return nil, fmt.Errorf("RiskManager: migrate instance %s: %w", id, err)
	}
	owners := actorOwners{actors: func(ctx context.Context) (mwanachamaactor.UserManager, error) { return r.ActorManager(ctx, id) }}
	return mwanachamariskmanager.NewRiskManager(r.db, s, mwanachamariskmanager.WithOwners(owners, actorObject))
}

func (r *registry) MarketManager(ctx context.Context, id, mount string) (mwanachamamarket.MarketManager, error) {
	if mount == "" {
		return nil, ErrMarketMountRequired
	}
	return r.markets.Get(ctx, id+"/"+mount, func(ctx context.Context) (mwanachamamarket.MarketManager, []string, error) {
		built, err := r.buildMarketManager(ctx, id, mount)
		return built, nil, err
	})
}

func (r *registry) buildMarketManager(ctx context.Context, id, mount string) (mwanachamamarket.MarketManager, error) {
	inst, err := r.GetInstance(ctx, id)
	if err != nil {
		return nil, err
	}
	s, err := mwanachamamarket.SpecForMount(inst.TableSlug, mount)
	if err != nil {
		return nil, fmt.Errorf("MarketManager: spec for instance %s mount %s: %w", id, mount, err)
	}
	if err := mwanachamamarket.Provision(r.db, s); err != nil {
		return nil, fmt.Errorf("MarketManager: migrate instance %s mount %s: %w", id, mount, err)
	}
	built, err := mwanachamamarket.NewMarketManager(r.db, s)
	if err != nil {
		return nil, err
	}
	built.UseCoordinators(func(ctx context.Context, caller string) bool {
		role, err := r.RoleOf(ctx, id, caller)
		if err == nil && role == RoleOwner {
			return true
		}
		return r.seatedAgent(ctx, id, caller)
	})
	built.UseAgents(func(ctx context.Context, caller string) bool {
		return r.seatedAgent(ctx, id, caller)
	})
	names := r.namesIn(id)
	built.UseNames(func(ctx context.Context, memberID string) string {
		name, err := names(ctx, memberID)
		if err != nil {
			return ""
		}
		return name
	})
	return built, nil
}

func (r *registry) seatedAgent(ctx context.Context, instanceID, caller string) bool {
	role, err := r.RoleOf(ctx, instanceID, caller)
	if err != nil || role != RoleAgent {
		return false
	}
	seat, err := r.AgencyRoleOf(ctx, instanceID, caller)
	return err == nil && seat != ""
}
