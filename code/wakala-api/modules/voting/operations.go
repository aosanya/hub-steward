package voting

import _ "embed"

//go:embed voting.operations.json
var operationsJSON []byte

func Operations() []byte { return operationsJSON }
