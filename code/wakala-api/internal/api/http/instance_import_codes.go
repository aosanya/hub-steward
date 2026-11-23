package http

import (
	"context"
	"fmt"
	"regexp"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
)

var keepableCode = regexp.MustCompile(`^[A-Z]{1,2}(?:-[A-Z]+)?-[0-9]{1,6}$`)

var keepableRecordCode = regexp.MustCompile(`^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$`)

const maxRecordCodeLength = 48

type keptCodes struct {
	codes   map[string]bool
	records map[string]bool
}

func validRecordCode(code string) bool {
	return keepableCode.MatchString(code) || (len(code) <= maxRecordCodeLength && keepableRecordCode.MatchString(code))
}

func (in importRequest) checkRecordCodes() error {
	seen := map[string]string{}
	for _, rc := range in.Records {
		if rc.Code == "" {
			continue
		}
		if !validRecordCode(rc.Code) {
			return fmt.Errorf("record %q: the code %q is not valid; use lower-case letters, digits and single underscores (tender, day_worked), at most %d characters, or the RC-n form", rc.Name, rc.Code, maxRecordCodeLength)
		}
		if first, repeated := seen[rc.Code]; repeated {
			return fmt.Errorf("record %q: the code %q is already the code of the record %q; give every record its own", rc.Name, rc.Code, first)
		}
		seen[rc.Code] = rc.Name
	}
	return nil
}

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
	kept := keptCodes{codes: map[string]bool{}, records: map[string]bool{}}
	for code, n := range seen {
		if n == 1 && keepableCode.MatchString(code) {
			kept.codes[code] = true
		}
	}
	for _, rc := range in.Records {
		if keepableRecordCode.MatchString(rc.Code) {
			kept.records[rc.Code] = true
		}
	}
	return kept
}

func (k keptCodes) reserving(ctx context.Context) context.Context {
	return mwanachamaagency.WithReservedCodes(ctx, k.codes)
}

func (k keptCodes) keeping(ctx context.Context, code string) context.Context {
	if k.codes[code] {
		return mwanachamaagency.WithKeptCode(ctx, code)
	}
	return ctx
}

func (k keptCodes) keepingRecord(ctx context.Context, code string) context.Context {
	if k.records[code] {
		return mwanachamaagency.WithKeptCode(ctx, code)
	}
	return k.keeping(ctx, code)
}
