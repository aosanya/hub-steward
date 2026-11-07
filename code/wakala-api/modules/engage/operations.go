package engage

import _ "embed"

//go:embed engage.operations.json
var operationsJSON []byte

func Operations() []byte { return operationsJSON }
