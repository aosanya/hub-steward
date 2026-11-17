package mwanachamataskmanager

import (
	"fmt"

	"wakalaserver/modules/shared/plaintext"
)

func checkTaskTitle(title string) error {
	if problem := plaintext.Problem("title", title); problem != "" {
		return fmt.Errorf("%w: %s", ErrInvalidTask, problem)
	}
	return nil
}
