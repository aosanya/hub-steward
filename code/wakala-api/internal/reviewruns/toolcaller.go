package reviewruns

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	mwanachamaagency "wakalaserver/modules/agency"
)

const (
	toolStartReview = "agency_start_review"
	toolReviewInput = "agency_review_input"
	toolRecordArea  = "agency_record_review_area"
	toolListRunning = "agency_list_running_reviews"
	toolGetReview   = "agency_get_review"
	alreadyRecorded = "already been recorded"
	alreadyRunning  = "already running"
	instanceIDKey   = "instance_id"
)

type ToolCaller interface {
	Call(ctx context.Context, tool string, args map[string]any) ([]byte, error)
}

type InstanceLister func(ctx context.Context) ([]string, error)

type CallerTools struct {
	Caller    ToolCaller
	Instances InstanceLister
	Agency    func(ctx context.Context, instanceID string) (mwanachamaagency.AgencyManager, error)
}

type items[T any] struct {
	Items []T `json:"items"`
}

func (t CallerTools) call(ctx context.Context, instanceID, tool string, args map[string]any) ([]byte, error) {
	with := map[string]any{instanceIDKey: instanceID}
	for k, v := range args {
		with[k] = v
	}
	return t.Caller.Call(ctx, tool, with)
}

func (t CallerTools) StartReview(ctx context.Context, instanceID, draftID, startedBy, area string) (Page, error) {
	if t.Agency != nil {
		return t.startSigned(ctx, instanceID, draftID, startedBy, area)
	}
	args := map[string]any{"draft_id": draftID}
	if area != "" {
		args["area"] = area
	}
	body, err := t.call(ctx, instanceID, toolStartReview, args)
	if err != nil {
		return Page{}, refusalOf(err)
	}
	return decodePage(body)
}

func (t CallerTools) startSigned(ctx context.Context, instanceID, draftID, startedBy, area string) (Page, error) {
	manager, err := t.Agency(ctx, instanceID)
	if err != nil {
		return Page{}, err
	}
	view, err := manager.StartReview(ctx, draftID, startedBy, area)
	if err != nil {
		return Page{}, refusalOf(err)
	}
	body, err := json.Marshal(view)
	if err != nil {
		return Page{}, err
	}
	return decodePage(body)
}

func (t CallerTools) ReviewInput(ctx context.Context, instanceID, reviewID, area string) ([]PreviousFinding, error) {
	body, err := t.call(ctx, instanceID, toolReviewInput, map[string]any{"review_id": reviewID, "area": area})
	if err != nil {
		return nil, err
	}
	var out struct {
		Previous []PreviousFinding `json:"previous"`
	}
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, fmt.Errorf("The earlier findings could not be read: %v.", err)
	}
	return out.Previous, nil
}

func (t CallerTools) RecordArea(ctx context.Context, instanceID string, args map[string]any) error {
	_, err := t.call(ctx, instanceID, toolRecordArea, args)
	return refusalOf(err)
}

func (t CallerTools) RunningReviews(ctx context.Context) ([]Running, error) {
	ids, err := t.Instances(ctx)
	if err != nil {
		return nil, err
	}
	var out []Running
	for _, id := range ids {
		found, err := t.runningIn(ctx, id)
		if err != nil {
			return nil, fmt.Errorf("instance %s: %w", id, err)
		}
		out = append(out, found...)
	}
	return out, nil
}

func (t CallerTools) runningIn(ctx context.Context, instanceID string) ([]Running, error) {
	reviews, err := t.runningOf(ctx, instanceID)
	if err != nil {
		return nil, err
	}
	var out []Running
	for _, r := range reviews {
		page, err := t.pageOf(ctx, instanceID, r.ID)
		if err != nil {
			return nil, err
		}
		out = append(out, Running{InstanceID: instanceID, Page: page})
	}
	return out, nil
}

func (t CallerTools) runningOf(ctx context.Context, instanceID string) ([]Review, error) {
	body, err := t.call(ctx, instanceID, toolListRunning, nil)
	if err != nil {
		return nil, err
	}
	var reviews items[Review]
	if err := json.Unmarshal(body, &reviews); err != nil {
		return nil, err
	}
	return reviews.Items, nil
}

func (t CallerTools) pageOf(ctx context.Context, instanceID, reviewID string) (Page, error) {
	body, err := t.call(ctx, instanceID, toolGetReview, map[string]any{"review_id": reviewID})
	if err != nil {
		return Page{}, err
	}
	return decodePage(body)
}

func decodePage(body []byte) (Page, error) {
	var page Page
	if err := json.Unmarshal(body, &page); err != nil {
		return Page{}, fmt.Errorf("The review could not be read: %v.", err)
	}
	return page, nil
}

func refusalOf(err error) error {
	if err == nil {
		return nil
	}
	text := err.Error()
	switch {
	case strings.Contains(text, alreadyRecorded):
		return ErrAreaAlreadyRecorded
	case strings.Contains(text, alreadyRunning):
		return ErrReviewAlreadyRuns
	}
	return err
}
