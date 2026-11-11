package http

import (
	"context"
	"regexp"

	mwanachamaagency "wakalaserver/modules/agency"
)

var keepableCode = regexp.MustCompile(`^[A-Z]{1,2}(?:-[A-Z]+)?-[0-9]{1,6}$`)

type keptCodes map[string]bool

func (in importRequest) fileCodes() []string {
	var codes []string
	add := func(code string) { codes = append(codes, code) }
	for _, r := range in.Roles {
		add(r.Code)
	}
	for _, g := range in.Goals {
		add(g.Code)
	}
	for _, o := range in.Objectives {
		add(o.Code)
	}
	for _, w := range in.Workflows {
		add(w.Code)
	}
	for _, wi := range in.WorkItems {
		add(wi.Code)
	}
	for _, rc := range in.Records {
		add(rc.Code)
	}
	for _, c := range in.controls() {
		add(c.Code)
	}
	for _, r := range in.Risks {
		add(r.Code)
	}
	return codes
}

func keptCodesOf(in importRequest) keptCodes {
	seen := map[string]int{}
	for _, code := range in.fileCodes() {
		seen[code]++
	}
	kept := keptCodes{}
	for code, n := range seen {
		if n == 1 && keepableCode.MatchString(code) {
			kept[code] = true
		}
	}
	return kept
}

func (k keptCodes) reserving(ctx context.Context) context.Context {
	return mwanachamaagency.WithReservedCodes(ctx, k)
}

func (k keptCodes) keeping(ctx context.Context, code string) context.Context {
	if k[code] {
		return mwanachamaagency.WithKeptCode(ctx, code)
	}
	return ctx
}
