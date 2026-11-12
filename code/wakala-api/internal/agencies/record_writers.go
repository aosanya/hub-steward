package agencies

import (
	"context"
	"encoding/json"

	mwanachamaaccounting "wakalaserver/modules/accounting"
	mwanachamacatalog "wakalaserver/modules/catalog"
	mwanachamaforms "wakalaserver/modules/forms"
	mwanachamaratings "wakalaserver/modules/ratings"
)

type catalogRecordWriter struct {
	catalog func(ctx context.Context) (mwanachamacatalog.CatalogManager, error)
}

func (w catalogRecordWriter) Write(ctx context.Context, landed mwanachamaforms.LandedRecord) error {
	_, name, err := landed.Target()
	if err != nil {
		return err
	}
	holder, err := json.Marshal(landed.Key)
	if err != nil {
		return err
	}
	doc, err := json.Marshal(landed.Fields)
	if err != nil {
		return err
	}
	cm, err := w.catalog(ctx)
	if err != nil {
		return err
	}
	_, err = cm.PutRecord(ctx, mwanachamacatalog.Record{SubjectID: name, HolderID: string(holder), Doc: string(doc)})
	return err
}

func (r *registry) recordWritersIn(id string) mwanachamaforms.RecordWriters {
	return func(module string) (mwanachamaforms.RecordWriter, bool) {
		switch module {
		case moduleCatalog:
			return catalogRecordWriter{catalog: func(ctx context.Context) (mwanachamacatalog.CatalogManager, error) {
				return r.CatalogManager(ctx, id, MountFormRecords)
			}}, true
		case moduleAccounting:
			return ledgerEntryWriter{ledger: func(ctx context.Context) (mwanachamaaccounting.LedgerRepository, error) {
				return r.LedgerRepository(ctx, id)
			}}, true
		case moduleRatings:
			return ratingWriter{ratings: func(ctx context.Context) (mwanachamaratings.RatingsManager, error) {
				return r.RatingsManager(ctx, id)
			}}, true
		}
		return nil, false
	}
}
