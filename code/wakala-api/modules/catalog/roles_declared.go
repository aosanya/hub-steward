package mwanachamacatalog

import "fmt"

func (m *catalogManager) declares(role string) bool {
	_, declared := m.st.Spec().ByRole(role)
	return declared
}

func (m *catalogManager) needs(roles ...string) error {
	for _, role := range roles {
		if !m.declares(role) {
			return fmt.Errorf("%w: %s", ErrRoleNotDeclared, role)
		}
	}
	return nil
}
