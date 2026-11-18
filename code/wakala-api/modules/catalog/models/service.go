package models

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

var ErrInvalidServiceTerms = errors.New("invalid service terms")

var (
	errNegativeFee  = fmt.Errorf("%w: the fee amount cannot be negative", ErrInvalidServiceTerms)
	errDaysBelowOne = fmt.Errorf("%w: days until due must be a whole number of at least 1", ErrInvalidServiceTerms)
)

type ServiceOpening string

const (
	ServiceOpensForm  ServiceOpening = "form"
	ServiceOpensRaise ServiceOpening = "raise"
)

const DefaultDaysUntilDue = 30

type ServiceTerms struct {
	Fee           string         `json:"fee,omitempty"`
	Form          string         `json:"form,omitempty"`
	Appointments  bool           `json:"appointments,omitempty"`
	Opens         ServiceOpening `json:"opens"`
	InspectorRole string         `json:"inspector_role,omitempty"`
	FeeAmount     *int           `json:"fee_amount,omitempty"`
	DaysUntilDue  *int           `json:"days_until_due,omitempty"`
}

func ServiceTermsOf(doc string) (ServiceTerms, error) {
	var t ServiceTerms
	if strings.TrimSpace(doc) == "" {
		return t, ErrInvalidServiceTerms
	}
	if err := json.Unmarshal([]byte(doc), &t); err != nil {
		return ServiceTerms{}, ErrInvalidServiceTerms
	}
	if t.Opens == "" {
		t.Opens = ServiceOpensForm
	}
	if err := t.Check(); err != nil {
		return ServiceTerms{}, err
	}
	if t.DaysUntilDue == nil {
		days := DefaultDaysUntilDue
		t.DaysUntilDue = &days
	}
	return t, nil
}

func (t ServiceTerms) Check() error {
	if t.FeeAmount != nil && *t.FeeAmount < 0 {
		return errNegativeFee
	}
	if t.DaysUntilDue != nil && *t.DaysUntilDue < 1 {
		return errDaysBelowOne
	}
	switch t.Opens {
	case ServiceOpensForm:
		if strings.TrimSpace(t.Form) == "" {
			return ErrInvalidServiceTerms
		}
	case ServiceOpensRaise:
		if t.Form != "" || t.Appointments {
			return ErrInvalidServiceTerms
		}
	default:
		return ErrInvalidServiceTerms
	}
	return nil
}

func (t ServiceTerms) Doc() (string, error) {
	if t.Opens == "" {
		t.Opens = ServiceOpensForm
	}
	if err := t.Check(); err != nil {
		return "", err
	}
	raw, err := json.Marshal(t)
	if err != nil {
		return "", err
	}
	return string(raw), nil
}
