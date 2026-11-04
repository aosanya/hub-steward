package mwanachamaagency

import (
	"strconv"
	"unicode"
)

func QuoteIfUnsafe(value string) string {
	for _, r := range value {
		if !unicode.IsPrint(r) {
			return strconv.Quote(value)
		}
	}
	return value
}
