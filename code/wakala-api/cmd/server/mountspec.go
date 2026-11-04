package main

import (
	"os"

	"wakalaserver/modules/shared/spec"

	"wakalaserver/internal/specs"
)

type specMount struct {
	module      string
	declaration string
	prefix      string
	load        func(string) (*spec.Spec, error)
	parse       func([]byte) (*spec.Spec, error)
}

func (m specMount) declarationName() string {
	if m.declaration != "" {
		return m.declaration
	}
	return m.module
}

func (m specMount) configured() bool {
	return os.Getenv(m.prefix+"_SPEC") != "" || os.Getenv(m.prefix+"_INSTANCE") != ""
}

func (m specMount) resolve() (*spec.Spec, string, error) {
	if path := os.Getenv(m.prefix + "_SPEC"); path != "" {
		s, err := m.load(path)
		return s, path, err
	}

	instance := os.Getenv(m.prefix + "_INSTANCE")
	name := m.declarationName()
	raw, err := specs.For(name, instance)
	if err != nil {
		return nil, name, err
	}
	s, err := m.parse(raw)
	return s, "embedded " + name + " declaration", err
}
