package models

import (
	"errors"
	"testing"
)

func TestAddressDeriveIsStableCanonicalAndPerKey(t *testing.T) {
	first, err := AddressDerive("device-key-one")
	if err != nil {
		t.Fatalf("derive: %v", err)
	}
	again, _ := AddressDerive("device-key-one")
	other, _ := AddressDerive("device-key-two")
	if first != again {
		t.Fatalf("same key gave %q then %q", first, again)
	}
	if first == other {
		t.Fatalf("two keys gave the same address %q", first)
	}
	if !AddressValid(first) || len(first) != 14 {
		t.Fatalf("derived address %q is not canonical", first)
	}
}

func TestAddressDeriveRefusesAnEmptyKey(t *testing.T) {
	for _, key := range []string{"", "   ", "\t\n"} {
		if _, err := AddressDerive(key); !errors.Is(err, ErrAddressMalformed) {
			t.Fatalf("key %q: want malformed, got %v", key, err)
		}
	}
}

func TestAddressNormalizeTakesWhatAPersonTypes(t *testing.T) {
	typed := []string{"MKU 4827 YUT 3391", "mku-4827-yut-3391", "mku_4827 yut\t3391", "MKU4827YUT3391"}
	for _, in := range typed {
		got, err := AddressNormalize(in)
		if err != nil || got != "MKU4827YUT3391" {
			t.Fatalf("%q gave %q, %v", in, got, err)
		}
	}
}

func TestAddressNormalizeRefusesWhatIsNotAnAddress(t *testing.T) {
	for _, in := range []string{"", "MKU4827YUT339", "MKU4827YUT33911", "4827MKUYUT3391", "MKU48271YUT339", "MKU 4827 YUT 33x1", "MK$4827YUT3391"} {
		if _, err := AddressNormalize(in); !errors.Is(err, ErrAddressMalformed) {
			t.Fatalf("%q: want malformed, got %v", in, err)
		}
	}
}

func TestAddressFormatGroupsOnlyACanonicalAddress(t *testing.T) {
	if got := AddressFormat("MKU4827YUT3391"); got != "MKU 4827 YUT 3391" {
		t.Fatalf("got %q", got)
	}
	if got := AddressFormat("not an address"); got != "not an address" {
		t.Fatalf("a non-address changed to %q", got)
	}
}

func TestAddressFormatAndNormalizeRoundTrip(t *testing.T) {
	derived, _ := AddressDerive("round-trip-key")
	back, err := AddressNormalize(AddressFormat(derived))
	if err != nil || back != derived {
		t.Fatalf("round trip gave %q, %v for %q", back, err, derived)
	}
}
