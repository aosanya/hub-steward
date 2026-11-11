package mwanachamacatalog

import (
	"context"
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"
)

const standingCancelledAt = ""

func (m *catalogManager) booksTimes() bool {
	_, slots := m.st.Spec().ByRole(roleSlot)
	_, bookings := m.st.Spec().ByRole(roleBooking)
	return slots && bookings
}

func (m *catalogManager) OfferSlot(ctx context.Context, s Slot) (Slot, error) {
	if !m.booksTimes() {
		return Slot{}, ErrTimesNotBooked
	}
	starts, err := time.Parse(time.RFC3339, s.StartsAt)
	if err != nil || s.SubjectID == "" {
		return Slot{}, ErrInvalidSlot
	}
	ends, err := time.Parse(time.RFC3339, s.EndsAt)
	if err != nil || !ends.After(starts) {
		return Slot{}, ErrInvalidSlot
	}
	if s.Capacity == 0 {
		s.Capacity = 1
	}
	if s.Capacity < 1 {
		return Slot{}, ErrInvalidSlot
	}
	s.ID = newID()
	s.StartsAt = starts.UTC().Format(time.RFC3339)
	s.EndsAt = ends.UTC().Format(time.RFC3339)
	s.CreatedAt = m.now()
	if err := m.insert(ctx, roleSlot, s); err != nil {
		return Slot{}, err
	}
	return s, nil
}

func (m *catalogManager) ListSlots(ctx context.Context, subjectID string) ([]Slot, error) {
	if !m.booksTimes() {
		return nil, ErrTimesNotBooked
	}
	if subjectID == "" {
		return nil, ErrInvalidSlot
	}
	return listOf[Slot](m, m.q(ctx, roleSlot).Where("subject_id = ?", subjectID).Order("starts_at, id"), roleSlot)
}

func (m *catalogManager) Book(ctx context.Context, slotID, holderID string) (Booking, error) {
	if !m.booksTimes() {
		return Booking{}, ErrTimesNotBooked
	}
	if slotID == "" || holderID == "" {
		return Booking{}, ErrInvalidSlot
	}
	var out Booking
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var slot Slot
		if err := m.take(tx.Table(m.st.Table(roleSlot)).Where("id = ?", slotID), roleSlot, &slot, ErrSlotNotFound); err != nil {
			return err
		}
		standing := tx.Table(m.st.Table(roleBooking)).Where("slot_id = ? AND cancelled_at = ?", slotID, standingCancelledAt)
		var mine int64
		if err := standing.Session(&gorm.Session{}).Where("holder_id = ?", holderID).Count(&mine).Error; err != nil {
			return err
		}
		if mine > 0 {
			return ErrAlreadyBooked
		}
		var taken int64
		if err := tx.Table(m.st.Table(roleBooking)).Where("slot_id = ? AND cancelled_at = ?", slotID, standingCancelledAt).Count(&taken).Error; err != nil {
			return err
		}
		if int(taken) >= slot.Capacity {
			return ErrSlotFull
		}
		out = Booking{
			ID:        newID(),
			SlotID:    slot.ID,
			SubjectID: slot.SubjectID,
			HolderID:  holderID,
			Day:       dayOf(slot.StartsAt),
			StartsAt:  slot.StartsAt,
			CreatedAt: m.now(),
		}
		row, err := encode(m.st.Object(roleBooking), out)
		if err != nil {
			return err
		}
		return tx.Table(m.st.Table(roleBooking)).Create(row).Error
	})
	if err != nil {
		return Booking{}, err
	}
	return out, nil
}

func dayOf(instant string) string {
	if i := strings.IndexByte(instant, 'T'); i > 0 {
		return instant[:i]
	}
	return instant
}

func (m *catalogManager) CancelBooking(ctx context.Context, bookingID, by, reason string) (Booking, error) {
	return m.cancelBooking(ctx, bookingID, by, reason, false)
}

func (m *catalogManager) CancelBookingAsStaff(ctx context.Context, bookingID, by, reason string) (Booking, error) {
	if strings.TrimSpace(reason) == "" {
		return Booking{}, ErrCancelReasonRequired
	}
	return m.cancelBooking(ctx, bookingID, by, reason, true)
}

func (m *catalogManager) cancelBooking(ctx context.Context, bookingID, by, reason string, staff bool) (Booking, error) {
	if !m.booksTimes() {
		return Booking{}, ErrTimesNotBooked
	}
	if bookingID == "" || by == "" {
		return Booking{}, ErrBookingNotFound
	}
	if err := plainText(ErrInvalidSlot, "reason", reason); err != nil {
		return Booking{}, err
	}
	var b Booking
	if err := m.take(m.q(ctx, roleBooking).Where("id = ?", bookingID), roleBooking, &b, ErrBookingNotFound); err != nil {
		return Booking{}, err
	}
	if !staff && b.HolderID != by {
		return Booking{}, ErrBookingNotFound
	}
	if b.CancelledAt != standingCancelledAt {
		return Booking{}, ErrBookingCancelled
	}
	at := m.now()
	res := m.q(ctx, roleBooking).Where("id = ? AND cancelled_at = ?", bookingID, standingCancelledAt).
		Updates(map[string]any{"cancelled_at": at, "cancelled_by": by, "cancel_reason": strings.TrimSpace(reason)})
	if res.Error != nil {
		return Booking{}, res.Error
	}
	if res.RowsAffected == 0 {
		return Booking{}, ErrBookingCancelled
	}
	b.CancelledAt, b.CancelledBy, b.CancelReason = at, by, strings.TrimSpace(reason)
	return b, nil
}

func (m *catalogManager) ListHolderBookings(ctx context.Context, holderID string) ([]Booking, error) {
	if !m.booksTimes() {
		return nil, ErrTimesNotBooked
	}
	if holderID == "" {
		return nil, ErrBookingNotFound
	}
	return listOf[Booking](m, m.q(ctx, roleBooking).Where("holder_id = ?", holderID).Order("starts_at, id"), roleBooking)
}

func (m *catalogManager) ListDayBookings(ctx context.Context, subjectID, day string) ([]Booking, error) {
	if !m.booksTimes() {
		return nil, ErrTimesNotBooked
	}
	if _, err := time.Parse("2006-01-02", day); err != nil {
		return nil, errors.Join(ErrInvalidSlot, err)
	}
	q := m.q(ctx, roleBooking).Where("day = ?", day)
	if subjectID != "" {
		q = q.Where("subject_id = ?", subjectID)
	}
	return listOf[Booking](m, q.Order("starts_at, id"), roleBooking)
}
