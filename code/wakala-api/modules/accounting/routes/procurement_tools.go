package routes

import "strings"

var procurementActionPrefixes = []string{"accounting.tender.", "accounting.quote."}

func isProcurementAction(action string) bool {
	for _, prefix := range procurementActionPrefixes {
		if strings.HasPrefix(action, prefix) {
			return true
		}
	}
	return false
}
