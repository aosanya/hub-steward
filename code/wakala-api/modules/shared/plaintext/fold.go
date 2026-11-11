package plaintext

import (
	"strings"

	"golang.org/x/text/unicode/norm"
)

const trailingMarks = ". "

func FoldName(name string) string {
	return norm.NFC.String(strings.TrimSpace(name))
}

func SameName(a, b string) bool {
	return FoldName(a) == FoldName(b)
}

func SameNameIgnoringCase(a, b string) bool {
	return strings.EqualFold(FoldName(a), FoldName(b))
}

func FoldDrawnName(name string) string {
	folded := strings.ToLower(strings.Join(strings.Fields(norm.NFKC.String(FoldName(name))), " "))
	if trimmed := strings.TrimRight(folded, trailingMarks); trimmed != "" {
		return trimmed
	}
	return folded
}
