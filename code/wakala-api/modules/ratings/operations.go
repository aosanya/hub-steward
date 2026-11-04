package mwanachamaratings

import _ "embed"

//go:embed ratings.operations.json
var operationsJSON []byte

func Operations() []byte { return operationsJSON }
