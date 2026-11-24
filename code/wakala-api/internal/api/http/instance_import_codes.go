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
	codes map[string]bool
}

func validRecordCode(code string) bool {
	return keepableCode.MatchString(code) || (len(code) <= maxRecordCodeLength && keepableRecordCode.MatchString(code))
}

func recordCodeRule() string {
	return fmt.Sprintf("use lower-case letters, digits and single underscores, starting with a letter (tender, day_worked), at most %d characters, or one or two capital letters, then optionally a hyphen and more capital letters, then a hyphen and one to six digits (RC-12, W-1, WI-4, AB-CD-12)", maxRecordCodeLength)
}

func (in importRequest) declaredRecordCodes() map[string]importRecord {
	declared := make(map[string]importRecord, len(in.Records))
	for _, rc := range in.Records {
		declared[rc.Code] = rc
	}
	return declared
}

func (in importRequest) stepsDerivingARecord() []importWorkItem {
	declared := in.declaredRecordCodes()
	var steps []importWorkItem
	for _, wi := range in.WorkItems {
		if _, adopted := declared[wi.RecordCode]; wi.RecordCode != "" && !adopted {
			steps = append(steps, wi)
		}
	}
	return steps
}

func (in importRequest) checkRecordCodes() error {
	seen := map[string]string{}
	for _, rc := range in.Records {
		if rc.Code == "" {
			continue
		}
		if !validRecordCode(rc.Code) {
			return fmt.Errorf("record %q: the code %q is not valid; %s", rc.Name, rc.Code, recordCodeRule())
		}
		if first, repeated := seen[rc.Code]; repeated {
			return fmt.Errorf("record %q: the code %q is already the code of the record %q; give every record its own", rc.Name, rc.Code, first)
		}
		seen[rc.Code] = rc.Name
	}
	return nil
}

type codedPart struct {
	kind string
	name string
	code string
}

func (in importRequest) otherCodedParts() []codedPart {
	var parts []codedPart
	for _, r := range in.Roles {
		parts = append(parts, codedPart{"role", r.Name, r.Code})
	}
	for _, g := range in.Goals {
		parts = append(parts, codedPart{"goal", g.Title, g.Code})
	}
	for _, o := range in.Objectives {
		parts = append(parts, codedPart{"objective", o.Title, o.Code})
	}
	for _, w := range in.Workflows {
		parts = append(parts, codedPart{"workflow", w.Name, w.Code})
	}
	for _, wi := range in.WorkItems {
		parts = append(parts, codedPart{"work item", wi.Title, wi.Code})
	}
	for _, c := range in.controls() {
		parts = append(parts, codedPart{"control", c.Text, c.Code})
	}
	for _, r := range in.Risks {
		parts = append(parts, codedPart{"risk", r.Title, r.Code})
	}
	return parts
}

func (in importRequest) fileCodes() []string {
	var codes []string
	for _, part := range in.otherCodedParts() {
		codes = append(codes, part.code)
	}
	for _, rc := range in.Records {
		codes = append(codes, rc.Code)
	}
	for _, wi := range in.stepsDerivingARecord() {
		codes = append(codes, wi.RecordCode)
	}
	return codes
}

func (in importRequest) checkRecordCodeClashes() error {
	held := map[string]codedPart{}
	for _, part := range in.otherCodedParts() {
		if _, taken := held[part.code]; part.code != "" && !taken {
			held[part.code] = part
		}
	}
	for _, rc := range in.Records {
		if part, clash := held[rc.Code]; clash {
			return fmt.Errorf("record %q: the code %q is also the code of the %s %q; give the record a code of its own", rc.Name, rc.Code, part.kind, part.name)
		}
	}
	for _, wi := range in.stepsDerivingARecord() {
		if part, clash := held[wi.RecordCode]; clash {
			return fmt.Errorf("work item %q: the record code %q is also the code of the %s %q; give the record a code of its own", wi.Title, wi.RecordCode, part.kind, part.name)
		}
	}
	return nil
}

func (in importRequest) checkRecordKeys() error {
	holder := map[string]string{}
	claim := func(owner string, keys ...string) error {
		own := map[string]bool{}
		for _, key := range keys {
			if key == "" || own[key] {
				continue
			}
			own[key] = true
			if first, taken := holder[key]; taken {
				return fmt.Errorf("%s: %q is also the id or code of %s; give every record its own", owner, key, first)
			}
		}
		for key := range own {
			holder[key] = owner
		}
		return nil
	}
	for _, rc := range in.Records {
		if err := claim(fmt.Sprintf("record %q", rc.Name), rc.ID, rc.Code); err != nil {
			return err
		}
	}
	for _, wi := range in.stepsDerivingARecord() {
		if err := claim(fmt.Sprintf("work item %q", wi.Title), wi.RecordCode); err != nil {
			return err
		}
	}
	return nil
}

func keptCodesOf(in importRequest) keptCodes {
	seen := map[string]int{}
	for _, code := range in.fileCodes() {
		seen[code]++
	}
	kept := keptCodes{codes: map[string]bool{}}
	for code, n := range seen {
		if n == 1 && keepableCode.MatchString(code) {
			kept.codes[code] = true
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
