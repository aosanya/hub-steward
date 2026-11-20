package agencies

import (
	"context"
	"fmt"
	"sync/atomic"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"

	mwanachamaaccounting "github.com/aosanya/mwanachama-backend-accounting"
)

var overpaymentDatabases atomic.Int64

type overpaymentTown struct {
	reg      *registry
	instance string
	ledger   mwanachamaaccounting.LedgerRepository
	bill     mwanachamaaccounting.Bill
	cash     mwanachamaaccounting.Account
}

func overpaymentTownWithBill(t *testing.T) overpaymentTown {
	t.Helper()
	dsn := fmt.Sprintf("file:wakala_overpayment_%d?mode=memory&cache=shared", overpaymentDatabases.Add(1))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			sqlDB.Close()
		}
	})
	built, err := NewRegistry(db)
	if err != nil {
		t.Fatalf("NewRegistry: %v", err)
	}
	reg := built.(*registry)
	ctx := context.Background()
	instance, err := reg.CreateInstance(ctx, "Town hall")
	if err != nil {
		t.Fatalf("CreateInstance: %v", err)
	}
	ledger, err := reg.LedgerRepository(ctx, instance.ID)
	if err != nil {
		t.Fatalf("LedgerRepository: %v", err)
	}
	open := func(code, category string, kind mwanachamaaccounting.AccountType) mwanachamaaccounting.Account {
		account, err := ledger.OpenAccount(ctx, mwanachamaaccounting.Account{Code: code, Category: mwanachamaaccounting.AccountCategory(category), HolderID: "hub-1", Type: kind})
		if err != nil {
			t.Fatalf("OpenAccount %s: %v", code, err)
		}
		return account
	}
	income := open("4000", "sales", mwanachamaaccounting.AccountTypeIncome)
	receivable := open("1200", "receivable", mwanachamaaccounting.AccountTypeAsset)
	cash := open("1000", "cash", mwanachamaaccounting.AccountTypeAsset)
	bill, err := ledger.CreateBill(ctx, mwanachamaaccounting.BillInput{
		IncomeAccountID: income.ID, ReceivableAccountID: receivable.ID, Payer: "stall-9",
		Amount: 500, DueAt: "2999-01-01T00:00:00Z", Narration: "Market stall fee", BilledBy: "clerk-1",
	})
	if err != nil {
		t.Fatalf("CreateBill: %v", err)
	}
	return overpaymentTown{reg: reg, instance: instance.ID, ledger: ledger, bill: bill, cash: cash}
}

func (town overpaymentTown) payMoreThanIsOwed() error {
	_, err := town.ledger.MarkBillPaid(context.Background(), mwanachamaaccounting.MarkPaidInput{
		BillID: town.bill.ID, CashAccountID: town.cash.ID, Amount: 700, PaidBy: "clerk-2",
	})
	return err
}

func (town overpaymentTown) ownerSetsOverpayment(t *testing.T, value string) {
	t.Helper()
	catalog, err := town.reg.CatalogManager(context.Background(), town.instance, MountFormRecords)
	if err != nil {
		t.Fatalf("CatalogManager: %v", err)
	}
	if _, err := catalog.PutSetting(context.Background(), PaymentOverpaymentSetting, value); err != nil {
		t.Fatalf("PutSetting: %v", err)
	}
}

func TestAPaymentAboveWhatIsOwedIsRefusedWhenTheOwnerHasSetNothing(t *testing.T) {
	town := overpaymentTownWithBill(t)
	if err := town.payMoreThanIsOwed(); err == nil {
		t.Fatalf("an overpayment with no owner setting was accepted, want a refusal")
	}
}

func TestAPaymentAboveWhatIsOwedGoesThroughOnceTheOwnerSettingAllowsItInTheFormsCatalog(t *testing.T) {
	town := overpaymentTownWithBill(t)
	town.ownerSetsOverpayment(t, "allowed")
	if err := town.payMoreThanIsOwed(); err != nil {
		t.Fatalf("an overpayment with the owner setting allowed = %v, want accepted", err)
	}
}

func TestAPaymentAboveWhatIsOwedIsRefusedAgainWhenTheOwnerSetsRefused(t *testing.T) {
	town := overpaymentTownWithBill(t)
	town.ownerSetsOverpayment(t, "allowed")
	town.ownerSetsOverpayment(t, "refused")
	if err := town.payMoreThanIsOwed(); err == nil {
		t.Fatalf("an overpayment with the owner setting refused was accepted")
	}
}
