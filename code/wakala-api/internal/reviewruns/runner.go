package reviewruns

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sync"
)

const panicReason = "The reviewer stopped unexpectedly."

type Runner struct {
	Tools     Tools
	Reviewers ReviewerSource
	Logger    *slog.Logger

	mu       sync.Mutex
	inFlight map[string]bool
	group    sync.WaitGroup
}

func NewRunner(tools Tools, reviewers ReviewerSource, logger *slog.Logger) *Runner {
	if logger == nil {
		logger = slog.Default()
	}
	return &Runner{Tools: tools, Reviewers: reviewers, Logger: logger, inFlight: map[string]bool{}}
}

func (r *Runner) Launch(ctx context.Context, instanceID string, page Page) {
	r.group.Add(1)
	go func() {
		defer r.group.Done()
		r.Run(ctx, instanceID, page)
	}()
}

func (r *Runner) Wait() {
	r.group.Wait()
}

func (r *Runner) Run(ctx context.Context, instanceID string, page Page) {
	if page.Review == nil {
		return
	}
	reading := page.Reading()
	if len(reading) == 0 {
		return
	}
	ctx = WithStartedBy(ctx, page.Review.StartedBy)
	roster, err := r.Reviewers.For(ctx, instanceID)
	if err != nil {
		r.failAll(ctx, instanceID, page, reading, ReasonOf(err))
		return
	}
	var parts sync.WaitGroup
	for _, area := range reading {
		key := instanceID + "/" + page.Review.ID + "/" + area
		if !r.claim(key) {
			continue
		}
		in := AreaInput{ReviewID: page.Review.ID, Area: area, DraftID: page.Review.DraftID}
		parts.Add(1)
		go func() {
			defer parts.Done()
			defer r.release(key)
			r.runArea(ctx, instanceID, roster, in)
		}()
	}
	parts.Wait()
}

func (r *Runner) claim(key string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.inFlight[key] {
		return false
	}
	r.inFlight[key] = true
	return true
}

func (r *Runner) release(key string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.inFlight, key)
}

func (r *Runner) failAll(ctx context.Context, instanceID string, page Page, areas []string, reason string) {
	for _, area := range areas {
		in := AreaInput{ReviewID: page.Review.ID, Area: area, DraftID: page.Review.DraftID}
		r.record(ctx, instanceID, in, FailedArgs(in, reason))
	}
}

func (r *Runner) runArea(ctx context.Context, instanceID string, roster Roster, in AreaInput) {
	reviewer, unavailable := roster.reviewerFor(in.Area)
	if reviewer == nil {
		r.record(ctx, instanceID, in, FailedArgs(in, unavailable))
		return
	}
	previous, err := r.Tools.ReviewInput(ctx, instanceID, in.ReviewID, in.Area)
	if err != nil {
		r.settleFailure(ctx, instanceID, in, err)
		return
	}
	in.Previous = previous
	result, err := r.review(ctx, reviewer, in)
	if err != nil {
		r.settleFailure(ctx, instanceID, in, err)
		return
	}
	if err := r.Tools.RecordArea(ctx, instanceID, RecordArgs(in, result)); err != nil {
		r.afterRecordError(ctx, instanceID, in, err)
	}
}

func (r *Runner) settleFailure(ctx context.Context, instanceID string, in AreaInput, err error) {
	if ctx.Err() != nil {
		r.Logger.Info("review part left reading for the next start", "instance", instanceID, "review", in.ReviewID, "area", in.Area)
		return
	}
	r.record(ctx, instanceID, in, FailedArgs(in, ReasonOf(err)))
}

func (r *Runner) afterRecordError(ctx context.Context, instanceID string, in AreaInput, err error) {
	if errors.Is(err, ErrAreaAlreadyRecorded) {
		r.Logger.Info("review part was already recorded", "instance", instanceID, "review", in.ReviewID, "area", in.Area)
		return
	}
	if ctx.Err() != nil {
		return
	}
	r.Logger.Error("review part could not be recorded", "instance", instanceID, "review", in.ReviewID, "area", in.Area, "error", err)
	r.record(ctx, instanceID, in, FailedArgs(in, ReasonOf(err)))
}

func (r *Runner) record(ctx context.Context, instanceID string, in AreaInput, args map[string]any) {
	err := r.Tools.RecordArea(ctx, instanceID, args)
	if err == nil {
		return
	}
	if errors.Is(err, ErrAreaAlreadyRecorded) {
		r.Logger.Info("review part was already recorded", "instance", instanceID, "review", in.ReviewID, "area", in.Area)
		return
	}
	r.Logger.Error("review part could not be marked failed", "instance", instanceID, "review", in.ReviewID, "area", in.Area, "error", err)
}

func (r *Runner) review(ctx context.Context, reviewer Reviewer, in AreaInput) (result AreaResult, err error) {
	defer func() {
		if recovered := recover(); recovered != nil {
			r.Logger.Error("reviewer panicked", "review", in.ReviewID, "area", in.Area, "panic", fmt.Sprint(recovered))
			err = errors.New(panicReason)
		}
	}()
	return reviewer.Review(ctx, in)
}
