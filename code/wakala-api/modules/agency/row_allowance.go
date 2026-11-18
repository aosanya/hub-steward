package mwanachamaagency

import "context"

type ExtraDetail struct {
	Prompt   string
	Required bool
}

type RowAllowance struct {
	Extra  []ExtraDetail
	Waived []string
}

type rowAllowanceKey struct{}

func WithRowAllowance(ctx context.Context, allowance RowAllowance) context.Context {
	return context.WithValue(ctx, rowAllowanceKey{}, allowance)
}

func rowAllowanceOf(ctx context.Context) RowAllowance {
	allowance, _ := ctx.Value(rowAllowanceKey{}).(RowAllowance)
	return allowance
}

func (a RowAllowance) extraNamed(prompt string) (ExtraDetail, bool) {
	for _, extra := range a.Extra {
		if extra.Prompt == prompt {
			return extra, true
		}
	}
	return ExtraDetail{}, false
}

func (a RowAllowance) waives(prompt string) bool {
	for _, waived := range a.Waived {
		if waived == prompt {
			return true
		}
	}
	return false
}
