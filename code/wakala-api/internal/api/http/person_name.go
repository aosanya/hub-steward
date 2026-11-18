package http

import (
	"strings"

	mwanachamaactor "wakalaserver/modules/actor"
)

const unnamedPerson = "Unnamed person"

func personNameOf(a mwanachamaactor.Actor) string {
	if name := strings.TrimSpace(a.DisplayName); name != "" {
		return name
	}
	if name := strings.TrimSpace(a.FirstName + " " + a.LastName); name != "" {
		return name
	}
	return unnamedPerson
}
