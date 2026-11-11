package agencies

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"

	mwanachamaaccounting "wakalaserver/modules/accounting"
	mwanachamaforms "wakalaserver/modules/forms"
)

const (
	moduleAccounting  = "accounting"
	recordLedgerEntry = "entry"
	landingDimension  = "landing"
	formDocumentKind  = "form"
	formActorFallback = "forms"
)

var ledgerEntryFormFields = []string{"amount", "credit_account_id", "debit_account_id", "dimensions", "due_at", "narration", "occurred_at"}

type ledgerEntryWriter struct {
	ledger func(ctx context.Context) (mwanachamaaccounting.LedgerRepository, error)
}

func (w ledgerEntryWriter) Write(ctx context.Context, landed mwanachamaforms.LandedRecord) error {
	module, name, err := landed.Target()
	if err != nil {
		return err
	}
	if module != moduleAccounting || name != recordLedgerEntry {
		return fmt.Errorf("accounting takes the record %s.%s from a form, not %s", moduleAccounting, recordLedgerEntry, landed.Record)
	}
	entry, err := ledgerEntryOf(landed)
	if err != nil {
		return err
	}
	if strings.TrimSpace(entry.DebitAccountID) == "" || strings.TrimSpace(entry.CreditAccountID) == "" {
		return fmt.Errorf("accounting.entry needs a debit_account_id and a credit_account_id")
	}
	landing := landingIDOf(landed.Key)
	entry.ActorID = actorOf(landed.Key)
	entry.DocumentKind = formDocumentKind
	entry.DocumentID = landing
	if _, taken := entry.Dimensions[landingDimension]; taken {
		return fmt.Errorf("accounting.entry: the dimension %q is the form's own and cannot be filled", landingDimension)
	}
	dimensions := make(map[string]string, len(entry.Dimensions)+1)
	for key, value := range entry.Dimensions {
		dimensions[key] = value
	}
	dimensions[landingDimension] = landing
	entry.Dimensions = dimensions
	repo, err := w.ledger(ctx)
	if err != nil {
		return err
	}
	posted, err := repo.ListEntriesByDimension(ctx, entry.DebitAccountID, landingDimension, landing, 1)
	if err != nil {
		return err
	}
	if len(posted) > 0 {
		return nil
	}
	_, err = repo.Post(ctx, entry)
	return err
}

func (ledgerEntryWriter) CheckFields(record string, fields []string) error {
	return checkFormFields(moduleAccounting, recordLedgerEntry, record, ledgerEntryFormFields, fields)
}

func ledgerEntryOf(landed mwanachamaforms.LandedRecord) (mwanachamaaccounting.Entry, error) {
	fields := make(map[string]any, len(landed.Fields))
	for name, value := range landed.Fields {
		if !contains(ledgerEntryFormFields, name) {
			return mwanachamaaccounting.Entry{}, fmt.Errorf("accounting.entry has no field %q a form may fill; the fields are %s", name, strings.Join(ledgerEntryFormFields, ", "))
		}
		fields[name] = value
	}
	if amount, ok := fields["amount"]; ok {
		whole, err := wholeNumber(amount)
		if err != nil {
			return mwanachamaaccounting.Entry{}, fmt.Errorf("accounting.entry amount: %w", err)
		}
		fields["amount"] = whole
	}
	raw, err := json.Marshal(fields)
	if err != nil {
		return mwanachamaaccounting.Entry{}, err
	}
	var entry mwanachamaaccounting.Entry
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&entry); err != nil {
		return mwanachamaaccounting.Entry{}, fmt.Errorf("accounting.entry: %w", err)
	}
	return entry, nil
}

func wholeNumber(value any) (int64, error) {
	switch v := value.(type) {
	case int:
		return int64(v), nil
	case int64:
		return v, nil
	case float32:
		return wholeNumber(float64(v))
	case float64:
		if v != math.Trunc(v) || math.IsInf(v, 0) || math.IsNaN(v) {
			return 0, fmt.Errorf("%v is not a whole number of the smallest unit", v)
		}
		return int64(v), nil
	case string:
		n, err := strconv.ParseInt(strings.TrimSpace(v), 10, 64)
		if err != nil {
			return 0, fmt.Errorf("%q is not a whole number", v)
		}
		return n, nil
	}
	return 0, fmt.Errorf("%v is not a number", value)
}

func landingIDOf(key map[string]string) string {
	names := make([]string, 0, len(key))
	for name := range key {
		names = append(names, name)
	}
	sort.Strings(names)
	var b strings.Builder
	for _, name := range names {
		b.WriteString(name)
		b.WriteByte('=')
		b.WriteString(key[name])
		b.WriteByte(0)
	}
	sum := sha256.Sum256([]byte(b.String()))
	return "form-" + hex.EncodeToString(sum[:])[:24]
}

func actorOf(key map[string]string) string {
	if member := strings.TrimSpace(key["member"]); member != "" {
		return member
	}
	return formActorFallback
}

func contains(list []string, name string) bool {
	for _, item := range list {
		if item == name {
			return true
		}
	}
	return false
}

func checkFormFields(module, name, record string, allowed, fields []string) error {
	if record != module+"."+name {
		return fmt.Errorf("%s takes the record %s.%s from a form, not %s", module, module, name, record)
	}
	for _, field := range fields {
		if !contains(allowed, field) {
			return fmt.Errorf("%s.%s has no field %q a form may fill; the fields are %s", module, name, field, strings.Join(allowed, ", "))
		}
	}
	return nil
}
