package plaintext

import (
	"strings"

	"golang.org/x/text/unicode/norm"
)

func FoldName(name string) string {
	return norm.NFC.String(strings.TrimSpace(name))
}

func SameName(a, b string) bool {
	return FoldName(a) == FoldName(b)
}

func SameNameIgnoringCase(a, b string) bool {
	return strings.EqualFold(FoldName(a), FoldName(b))
}
