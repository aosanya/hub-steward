package languages

import (
	"errors"
	"strings"
)

var Offered = []string{"DE", "EN", "ES", "FR", "SW", "HU", "RU", "JA", "ZH"}

const Fallback = "EN"

var (
	ErrUnknownLanguage  = errors.New("a language must be one of DE, EN, ES, FR, SW, HU, RU, JA, ZH")
	ErrNoContent        = errors.New("an agency needs at least one content language")
	ErrRepeated         = errors.New("a content language is named twice")
	ErrDefaultNotListed = errors.New("the content default must be one of the content languages")
	ErrNoInstance       = errors.New("agency languages need an instance")
	ErrNoPerson         = errors.New("a studio language needs a person")
)

type Agency struct {
	StudioDefault  string   `json:"studio_default"`
	Content        []string `json:"content"`
	ContentDefault string   `json:"content_default"`
}

func DefaultAgency() Agency {
	return Agency{StudioDefault: Fallback, Content: []string{Fallback}, ContentDefault: Fallback}
}

func Normalize(code string) (string, error) {
	c := strings.ToUpper(strings.TrimSpace(code))
	for _, o := range Offered {
		if c == o {
			return c, nil
		}
	}
	return "", ErrUnknownLanguage
}

func Validate(a Agency) (Agency, error) {
	studio, err := Normalize(a.StudioDefault)
	if err != nil {
		return Agency{}, err
	}
	if len(a.Content) == 0 {
		return Agency{}, ErrNoContent
	}
	seen := map[string]bool{}
	for _, c := range a.Content {
		n, err := Normalize(c)
		if err != nil {
			return Agency{}, err
		}
		if seen[n] {
			return Agency{}, ErrRepeated
		}
		seen[n] = true
	}
	def, err := Normalize(a.ContentDefault)
	if err != nil {
		return Agency{}, err
	}
	if !seen[def] {
		return Agency{}, ErrDefaultNotListed
	}
	content := make([]string, 0, len(seen))
	for _, o := range Offered {
		if seen[o] {
			content = append(content, o)
		}
	}
	return Agency{StudioDefault: studio, Content: content, ContentDefault: def}, nil
}
