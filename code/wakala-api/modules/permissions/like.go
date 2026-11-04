package mwanachamapermissions

import "strings"

const likeEscape = "!"

var likeEscaper = strings.NewReplacer(likeEscape, likeEscape+likeEscape, "%", likeEscape+"%", "_", likeEscape+"_")

func containsPattern(text string) string {
	return "%" + likeEscaper.Replace(lower(text)) + "%"
}

func containsClause(column string) string {
	return "lower(" + column + ") like ? escape '" + likeEscape + "'"
}
