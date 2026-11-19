package agencies

import (
	"errors"
	"testing"

	mwanachamacatalog "github.com/aosanya/mwanachama-backend-catalog"
)

func TestOnlyTheValueAllowedLetsAPaymentGoAboveWhatIsOwed(t *testing.T) {
	cases := []struct {
		value   string
		err     error
		want    bool
		wantErr bool
	}{
		{"allowed", nil, true, false},
		{"refused", nil, false, false},
		{"", mwanachamacatalog.ErrSettingNotFound, false, false},
		{"", errors.New("read failed"), false, true},
	}
	for _, c := range cases {
		got, err := settingAllows(c.value, c.err, overpaymentAllowedValue)
		if got != c.want || (err != nil) != c.wantErr {
			t.Fatalf("settingAllows(%q, %v) = %v, %v", c.value, c.err, got, err)
		}
	}
}
