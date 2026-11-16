package mwanachamacouncil

import "time"

const dateLayout = "2006-01-02"

var patterns = map[string]func(string) bool{
	"date": func(s string) bool {
		_, err := time.Parse(dateLayout, s)
		return err == nil
	},
}
