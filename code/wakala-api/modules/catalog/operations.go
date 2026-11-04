package mwanachamacatalog

import _ "embed"

//go:embed catalog.operations.json
var operationsJSON []byte

func Operations() []byte { return operationsJSON }
