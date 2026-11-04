package models

import (
	"encoding/json"
	"errors"
	"strings"
)

var ErrInvalidServiceTerms = errors.New("invalid service terms")

type ServiceOpening string

const (
	ServiceOpensForm  ServiceOpening = "form"
	ServiceOpensRaise ServiceOpening = "raise"
)

type ServiceTerms struct {
	Fee          string         `json:"fee,omitempty"`
	Form         string         `json:"form,omitempty"`
	Appointments bool           `json:"appointments,omitempty"`
	Opens        ServiceOpening `json:"opens"`
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
	return t, nil
}

func (t ServiceTerms) Check() error {
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
