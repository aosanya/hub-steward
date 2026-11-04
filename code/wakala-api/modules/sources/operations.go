package sources

import _ "embed"

//go:embed sources.operations.json
var operationsJSON []byte

func Operations() []byte { return operationsJSON }
