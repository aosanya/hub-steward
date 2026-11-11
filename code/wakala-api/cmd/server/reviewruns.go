package main

import (
	"context"
	"log/slog"
	"time"

	"github.com/modelcontextprotocol/go-sdk/mcp"
	mwanachamaagency "wakalaserver/modules/agency"
	agencymcp "wakalaserver/modules/agency/mcp"
	ai "wakalaserver/modules/ai"

	"wakalaserver/internal/agencies"
	"wakalaserver/internal/reviewruns"
)

const reviewResumeDelay = 10 * time.Second

func newReviewService(logger *slog.Logger, registry agencies.Registry, resolveAI func(ctx context.Context, instanceID string) (ai.Manager, error)) *reviewruns.Service {
	caller := &reviewruns.MCPCaller{Register: func(server *mcp.Server) {
		agencymcp.RegisterTools(server, func(ctx context.Context, id string) (mwanachamaagency.AgencyManager, error) {
			return registry.AgencyManager(ctx, id)
		})
	}}
	tools := reviewruns.CallerTools{Caller: caller, Instances: instanceIDsOf(registry), Agency: registry.AgencyManager}
	pieces := reviewruns.Pieces{
		AI:     resolveAI,
		Agency: registry.AgencyManager,
		Kind:   instanceKindOf(registry),
	}
	return &reviewruns.Service{
		Tools:   tools,
		Account: reviewruns.DefaultAccountCheck(resolveAI),
		Runner:  reviewruns.NewRunner(tools, pieces, logger),
	}
}

func instanceIDsOf(registry agencies.Registry) reviewruns.InstanceLister {
	return func(ctx context.Context) ([]string, error) {
		instances, err := registry.ListInstances(ctx)
		if err != nil {
			return nil, err
		}
		ids := make([]string, 0, len(instances))
		for _, i := range instances {
			ids = append(ids, i.ID)
		}
		return ids, nil
	}
}

func instanceKindOf(registry agencies.Registry) func(ctx context.Context, instanceID string) (string, error) {
	return func(ctx context.Context, instanceID string) (string, error) {
		instance, err := registry.GetInstance(ctx, instanceID)
		return instance.Kind, err
	}
}

func resumeReviews(ctx context.Context, service interface{ Resume(context.Context) error }, logger *slog.Logger) {
	select {
	case <-ctx.Done():
		return
	case <-time.After(reviewResumeDelay):
	}
	if err := service.Resume(ctx); err != nil {
		logger.Error("reviews under way could not be picked up again", "error", err.Error())
		return
	}
	logger.Info("reviews under way picked up again")
}
