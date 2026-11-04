package mwanachamaworkspace

import "regexp"

var actionPattern = regexp.MustCompile(`^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$`)

func isAction(s string) bool { return actionPattern.MatchString(s) }

var patterns = map[string]func(string) bool{
	"action": isAction,
}
