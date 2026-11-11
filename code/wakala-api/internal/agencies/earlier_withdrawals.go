package agencies

import (
	"context"
	"log/slog"

	mwanachamaforms "wakalaserver/modules/forms"
	"wakalaserver/modules/shared/spec"
)

func (r *registry) hideEarlierWithdrawals(ctx context.Context, instanceID string, s *spec.Spec) {
	if !r.hidesOnWithdrawal() {
		return
	}
	stamped, err := r.stampEarlierWithdrawals(ctx, instanceID, s)
	if err != nil {
		slog.WarnContext(ctx, "earlier withdrawals not hidden", "instance", instanceID, "error", err.Error())
		return
	}
	if stamped.Members == 0 {
		return
	}
	slog.InfoContext(ctx, "earlier withdrawals hidden",
		"instance", instanceID, "members", stamped.Members, "sends", stamped.Sends, "answers", stamped.Answers)
}

func (r *registry) stampEarlierWithdrawals(ctx context.Context, instanceID string, s *spec.Spec) (mwanachamaforms.EarlierWithdrawalsStamped, error) {
	mounted, err := r.isMounted(ctx, instanceID, "custody")
	if err != nil || !mounted {
		return mwanachamaforms.EarlierWithdrawalsStamped{}, err
	}
	cm, err := r.CustodyManager(ctx, instanceID)
	if err != nil {
		return mwanachamaforms.EarlierWithdrawalsStamped{}, err
	}
	withdrawn, err := cm.WithdrawnConsents(ctx)
	if err != nil {
		return mwanachamaforms.EarlierWithdrawalsStamped{}, err
	}
	earlier := make([]mwanachamaforms.EarlierWithdrawal, 0, len(withdrawn))
	for _, w := range withdrawn {
		earlier = append(earlier, mwanachamaforms.EarlierWithdrawal{MemberID: w.ActorID, WithdrawnAt: w.WithdrawnAt})
	}
	return mwanachamaforms.StampEarlierWithdrawals(r.db, s, earlier)
}
