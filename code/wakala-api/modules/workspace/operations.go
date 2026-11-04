package mwanachamaworkspace

import _ "embed"

//go:embed workspace.operations.json
var operationsJSON []byte

func Operations() []byte { return operationsJSON }

//go:embed workspace.layouts.operations.json
var layoutOperationsJSON []byte

func LayoutOperations() []byte { return layoutOperationsJSON }
