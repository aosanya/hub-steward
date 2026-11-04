package reviewruns

import (
	"context"
	"errors"
	"fmt"

	mwanachamaai "wakalaserver/modules/ai"
)

type AccountCheck func(ctx context.Context, instanceID string) error

type AIResolver func(ctx context.Context, instanceID string) (mwanachamaai.Manager, error)

func DefaultAccountCheck(resolve AIResolver) AccountCheck {
	return func(ctx context.Context, instanceID string) error {
		if resolve == nil {
			return ErrNoDefaultAccount
		}
		manager, err := resolve(ctx, instanceID)
		if err != nil {
			return err
		}
		_, err = manager.GetDefaultAccount(ctx, instanceID)
		if errors.Is(err, mwanachamaai.ErrNoDefaultAccount) {
			return ErrNoDefaultAccount
		}
		return err
	}
}

type Service struct {
	Tools    Tools
	Account  AccountCheck
	Runner   *Runner
	Lifetime context.Context
}

func (s *Service) Start(ctx context.Context, instanceID, draftID, startedBy, area string) (Page, error) {
	if err := s.Account(ctx, instanceID); err != nil {
		return Page{}, err
	}
	page, err := s.Tools.StartReview(ctx, instanceID, draftID, startedBy, area)
	if err != nil {
		return Page{}, err
	}
	s.Runner.Launch(s.lifetime(), instanceID, page)
	return page, nil
}

func (s *Service) Resume(ctx context.Context) error {
	running, err := s.Tools.RunningReviews(ctx)
	if err != nil {
		return fmt.Errorf("The running reviews could not be listed: %w", err)
	}
	for _, r := range running {
		s.Runner.Launch(s.lifetime(), r.InstanceID, r.Page)
	}
	return nil
}

func (s *Service) lifetime() context.Context {
	if s.Lifetime == nil {
		return context.Background()
	}
	return s.Lifetime
}
