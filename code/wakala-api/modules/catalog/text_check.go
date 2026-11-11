package mwanachamacatalog

import (
	"fmt"

	"wakalaserver/modules/shared/plaintext"
)

func plainText(invalid error, label, text string) error {
	if err := plaintext.CheckText(label, text); err != nil {
		return fmt.Errorf("%w: %v", invalid, err)
	}
	return nil
}
