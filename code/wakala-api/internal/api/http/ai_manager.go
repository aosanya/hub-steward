package http

import (
	"context"
	"errors"
	"time"

	"gorm.io/gorm"

	ai "wakalaserver/modules/ai"

	"wakalaserver/internal/agencies"
	"wakalaserver/internal/authz"
)

const aiMount = "ai"

const aiChatTimeout = 120 * time.Second

func NewAIResolver(db *gorm.DB, reg agencies.Registry, masterKey []byte) AIResolver {
	return NewBoundedAIResolver(db, reg, masterKey, authz.DefaultMaxEntries)
}

func NewBoundedAIResolver(db *gorm.DB, reg agencies.Registry, masterKey []byte, max int) AIResolver {
	return newAIResolver(db, reg, masterKey, max, aiGuardOptions())
}

func newAIResolver(db *gorm.DB, reg agencies.Registry, masterKey []byte, max int, guard []ai.Option) AIResolver {
	held := authz.NewCache[ai.Manager]("ai-managers", nil, authz.WithTTL[ai.Manager](0), authz.WithMaxEntries[ai.Manager](max))
	return func(ctx context.Context, instanceID string) (ai.Manager, error) {
		return held.Get(ctx, instanceID, func(ctx context.Context) (ai.Manager, []string, error) {
			built, err := openAIManager(ctx, db, reg, masterKey, instanceID, guard)
			return built, nil, err
		})
	}
}

func openAIManager(ctx context.Context, db *gorm.DB, reg agencies.Registry, masterKey []byte, instanceID string, guard []ai.Option) (ai.Manager, error) {
	inst, err := reg.GetInstance(ctx, instanceID)
	if err != nil {
		return nil, err
	}
	s, err := ai.SpecForMount(inst.TableSlug, aiMount)
	if err != nil {
		return nil, err
	}
	if err := ai.Provision(db, s); err != nil {
		return nil, err
	}
	src := &seatBriefSource{reg: reg}
	built, err := ai.NewManager(db, s, append(append([]ai.Option(nil), guard...), ai.WithMasterKey(masterKey), ai.WithInstructionSource(src), ai.WithOwnerCheck(registryOwnerCheck(reg, instanceID)))...)
	if err != nil {
		return nil, err
	}
	src.ai = built
	return built, nil
}

func registryOwnerCheck(reg agencies.Registry, instanceID string) func(context.Context, string) (bool, error) {
	return func(ctx context.Context, personID string) (bool, error) {
		role, err := reg.RoleOf(ctx, instanceID, personID)
		if errors.Is(err, agencies.ErrInstanceNotFound) {
			return false, nil
		}
		if err != nil {
			return false, err
		}
		return role == agencies.RoleOwner, nil
	}
}
