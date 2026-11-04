package mwanachamaworkspace

import "errors"

var ErrInvalidWorkbook = errors.New("workspace: a workbook needs an owner and a title")

var ErrWorkbookNotFound = errors.New("workspace: no such workbook")

var ErrInvalidReference = errors.New("workspace: a reference needs a workbook, a module and a label")

var ErrReferenceNotFound = errors.New("workspace: no such reference")

var ErrInvalidUse = errors.New("workspace: a use needs a workbook and a well-formed action")

var ErrInvalidAction = errors.New("workspace: that is not a well-formed action")

var ErrInvalidShare = errors.New("workspace: a share needs a workbook and a key")

var ErrShareNotFound = errors.New("workspace: no such share")

var ErrShareRetired = errors.New("workspace: that key no longer opens this workbook")

var ErrLayoutsNotDeclared = errors.New("workspace: this domain fills no layout, layout_change and layout_choice")

var ErrInvalidLayout = errors.New("workspace: a layout needs a scope, an owner, a title and a JSON object for a body")

var ErrLayoutNotFound = errors.New("workspace: no such layout")

var ErrLayoutMoved = errors.New("workspace: that layout has moved on since you read it")

var ErrLayoutPublished = errors.New("workspace: that layout is published already")

var ErrLayoutNotWhole = errors.New("workspace: only a whole layout can be published")

var ErrLayoutNotAPatch = errors.New("workspace: only a patch over another layout can be cleared")

var ErrInvalidPatch = errors.New("workspace: a patch is a JSON object")

var ErrInvalidPointer = errors.New("workspace: that is not a JSON pointer")

var ErrLayoutChangeNotFound = errors.New("workspace: no change of that layout is left to undo")

var ErrLayoutChangeReverted = errors.New("workspace: that change has already been undone")

var ErrInvalidCopy = errors.New("workspace: a copy needs somebody to belong to")

var ErrInvalidChoice = errors.New("workspace: a choice needs a workbook and a person")

var ErrChoiceNotFound = errors.New("workspace: that person has chosen no layout in that workbook")
