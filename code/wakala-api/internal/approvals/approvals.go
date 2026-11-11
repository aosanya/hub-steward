package approvals

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

const (
	StatusPending  = "pending"
	StatusApproved = "approved"
	StatusRefused  = "refused"
)

var (
	ErrNotFound       = errors.New("approval not found")
	ErrAlreadyDecided = errors.New("approval already decided")
	ErrInvalid        = errors.New("kind and summary are required")
	ErrBadDecision    = errors.New("decision must be approved or refused")

	ErrChangedSinceRead = errors.New("the approval changed after it was read, so read it again before deciding")

	ErrPatchNeedsApproval = errors.New("payload_patch is only allowed when approving")
	ErrBadPatch           = errors.New("payload_patch must be a JSON object")
	ErrPayloadNotObject   = errors.New("the proposal's payload is not a JSON object, so it cannot take a payload_patch")

	ErrNotProposer    = errors.New("only the proposer or an owner may amend a proposal")
	ErrNothingToAmend = errors.New("an amendment needs a summary or a payload_patch")

	ErrCannotRestore = errors.New("the payload as proposed is not known, so a patched approval cannot be put back")
)

const refusedPatchSummary = "approving with this payload_patch was refused by the write, so the payload is back as proposed"

const amendAttempts = 5

type Approval struct {
	ID           string `json:"id" gorm:"primaryKey"`
	Kind         string `json:"kind"`
	Summary      string `json:"summary"`
	Payload      string `json:"payload"`
	PayloadPatch string `json:"payload_patch"`
	Status       string `json:"status" gorm:"index"`
	ProposedBy   string `json:"proposed_by"`
	AmendedBy    string `json:"amended_by"`
	AmendedAt    string `json:"amended_at"`
	Amendments   string `json:"amendments"`
	DecidedBy    string `json:"decided_by"`
	Reason       string `json:"reason"`
	ProposedAt   string `json:"proposed_at"`
	DecidedAt    string `json:"decided_at"`
	Applied      string `json:"applied"`

	ProposedPayload string `json:"-" gorm:"-"`
}

type Store struct {
	db        *gorm.DB
	table     string
	afterRead func()
}

func TableFor(slug string) string { return slug + "_approvals" }

func Open(db *gorm.DB, slug string) (*Store, error) {
	table := TableFor(slug)
	if err := db.Table(table).AutoMigrate(&Approval{}); err != nil {
		return nil, err
	}
	return &Store{db: db, table: table}, nil
}

func now() string { return time.Now().UTC().Format(time.RFC3339Nano) }

func (s *Store) q(ctx context.Context) *gorm.DB { return s.db.WithContext(ctx).Table(s.table) }

func (s *Store) Propose(ctx context.Context, proposer, kind, summary, payload string) (Approval, error) {
	if kind == "" || summary == "" {
		return Approval{}, ErrInvalid
	}
	a := Approval{ID: uuid.NewString(), Kind: kind, Summary: summary, Payload: payload, Status: StatusPending, ProposedBy: proposer, ProposedAt: now()}
	if err := s.q(ctx).Create(&a).Error; err != nil {
		return Approval{}, err
	}
	return a, nil
}

func (s *Store) List(ctx context.Context, status string) ([]Approval, error) {
	q := s.q(ctx)
	if status != "" {
		q = q.Where("status = ?", status)
	}
	out := []Approval{}
	if err := q.Order("proposed_at desc").Find(&out).Error; err != nil {
		return nil, err
	}
	return out, nil
}

func (s *Store) Get(ctx context.Context, id string) (Approval, error) {
	var a Approval
	err := s.q(ctx).Where("id = ?", id).Take(&a).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return Approval{}, ErrNotFound
	}
	return a, err
}

func (s *Store) patchedPayload(ctx context.Context, id, decision, payloadPatch string) (map[string]any, Approval, error) {
	if decision != StatusApproved {
		return nil, Approval{}, ErrPatchNeedsApproval
	}
	patch, isObject := decodeObject(payloadPatch)
	if !isObject {
		return nil, Approval{}, ErrBadPatch
	}
	held, err := s.Get(ctx, id)
	if err != nil {
		return nil, Approval{}, err
	}
	if held.Status != StatusPending {
		return nil, Approval{}, ErrAlreadyDecided
	}
	patched, applied, err := applyPatch(held.Payload, patch)
	if err != nil {
		return nil, Approval{}, err
	}
	return map[string]any{"payload": patched, "payload_patch": applied}, held, nil
}

func applyPatch(heldPayload string, patch map[string]any) (string, string, error) {
	payload, isObject := decodeObject(heldPayload)
	if !isObject {
		return "", "", ErrPayloadNotObject
	}
	mergePatch(payload, patch)
	patched, err := encodeObject(payload)
	if err != nil {
		return "", "", err
	}
	applied, err := encodeObject(patch)
	if err != nil {
		return "", "", err
	}
	return patched, applied, nil
}

type amendment struct {
	At      string `json:"at"`
	By      string `json:"by"`
	Summary string `json:"summary,omitempty"`
	Patch   string `json:"payload_patch,omitempty"`
}

func (s *Store) Amend(ctx context.Context, id, caller string, callerIsOwner bool, summary, payloadPatch string) (Approval, error) {
	if summary == "" && payloadPatch == "" {
		return Approval{}, ErrNothingToAmend
	}
	var patch map[string]any
	if payloadPatch != "" {
		decoded, isObject := decodeObject(payloadPatch)
		if !isObject {
			return Approval{}, ErrBadPatch
		}
		patch = decoded
	}
	for attempt := 0; attempt < amendAttempts; attempt++ {
		held, err := s.Get(ctx, id)
		if err != nil {
			return Approval{}, err
		}
		if !callerIsOwner && (caller == "" || held.ProposedBy != caller) {
			return Approval{}, ErrNotProposer
		}
		if held.Status != StatusPending {
			return Approval{}, ErrAlreadyDecided
		}
		changes, err := amendedColumns(held, caller, summary, patch)
		if err != nil {
			return Approval{}, err
		}
		res := s.q(ctx).Where("id = ? AND status = ? AND COALESCE(payload, '') = ? AND COALESCE(amendments, '') = ?", id, StatusPending, held.Payload, held.Amendments).Updates(changes)
		if res.Error != nil {
			return Approval{}, res.Error
		}
		if res.RowsAffected == 1 {
			return s.Get(ctx, id)
		}
	}
	return Approval{}, ErrAlreadyDecided
}

func amendedColumns(held Approval, caller, summary string, patch map[string]any) (map[string]any, error) {
	stamp := now()
	record := amendment{At: stamp, By: caller, Summary: summary}
	changes := map[string]any{"amended_by": caller, "amended_at": stamp}
	if summary != "" {
		changes["summary"] = summary
	}
	if patch != nil {
		patched, applied, err := applyPatch(held.Payload, patch)
		if err != nil {
			return nil, err
		}
		changes["payload"] = patched
		record.Patch = applied
	}
	history, err := amendmentsIn(held.Amendments)
	if err != nil {
		return nil, err
	}
	encoded, err := json.Marshal(append(history, record))
	if err != nil {
		return nil, err
	}
	changes["amendments"] = string(encoded)
	return changes, nil
}

func amendmentsIn(amendments string) ([]amendment, error) {
	history := []amendment{}
	if amendments == "" {
		return history, nil
	}
	if err := json.Unmarshal([]byte(amendments), &history); err != nil {
		return nil, err
	}
	return history, nil
}

func (s *Store) Decide(ctx context.Context, id, decider, decision, reason, payloadPatch string) (Approval, error) {
	return s.DecideSeen(ctx, id, decider, decision, reason, payloadPatch, 0)
}

func (s *Store) DecideSeen(ctx context.Context, id, decider, decision, reason, payloadPatch string, seenAmendments int) (Approval, error) {
	return s.decide(ctx, id, decider, decision, reason, payloadPatch, seenAmendments)
}

func checkSeen(held Approval, seenAmendments int) error {
	history, err := amendmentsIn(held.Amendments)
	if err != nil {
		return err
	}
	if len(history) != seenAmendments {
		return ErrChangedSinceRead
	}
	return nil
}

func (s *Store) decide(ctx context.Context, id, decider, decision, reason, payloadPatch string, seenAmendments int) (Approval, error) {
	if decision != StatusApproved && decision != StatusRefused {
		return Approval{}, ErrBadDecision
	}
	for attempt := 0; attempt < amendAttempts; attempt++ {
		changes := map[string]any{"status": decision, "decided_by": decider, "reason": reason, "decided_at": now()}
		guard := s.q(ctx).Where("id = ? AND status = ?", id, StatusPending)
		held := Approval{}
		if payloadPatch != "" {
			patched, read, err := s.patchedPayload(ctx, id, decision, payloadPatch)
			if err != nil {
				return Approval{}, err
			}
			held = read
			for column, value := range patched {
				changes[column] = value
			}
			if s.afterRead != nil {
				s.afterRead()
			}
		} else {
			read, err := s.Get(ctx, id)
			if err != nil {
				return Approval{}, err
			}
			if read.Status != StatusPending {
				return Approval{}, ErrAlreadyDecided
			}
			held = read
		}
		if err := checkSeen(held, seenAmendments); err != nil {
			return Approval{}, err
		}
		guard = guard.Where("COALESCE(payload, '') = ? AND COALESCE(amendments, '') = ?", held.Payload, held.Amendments)
		res := guard.Updates(changes)
		if res.Error != nil {
			return Approval{}, res.Error
		}
		if res.RowsAffected == 1 {
			decided, err := s.Get(ctx, id)
			decided.ProposedPayload = held.Payload
			return decided, err
		}
		current, err := s.Get(ctx, id)
		if err != nil {
			return Approval{}, err
		}
		if current.Status != StatusPending {
			return Approval{}, ErrAlreadyDecided
		}
	}
	return Approval{}, ErrAlreadyDecided
}

func (s *Store) Reopen(ctx context.Context, a Approval) error {
	changes := map[string]any{"status": StatusPending, "decided_by": "", "reason": "", "decided_at": "", "applied": ""}
	if a.PayloadPatch != "" {
		if a.ProposedPayload == "" {
			return ErrCannotRestore
		}
		held, err := s.Get(ctx, a.ID)
		if err != nil {
			return err
		}
		history, err := amendmentsIn(held.Amendments)
		if err != nil {
			return err
		}
		encoded, err := json.Marshal(append(history, amendment{At: now(), By: a.DecidedBy, Summary: refusedPatchSummary, Patch: a.PayloadPatch}))
		if err != nil {
			return err
		}
		changes["payload"] = a.ProposedPayload
		changes["payload_patch"] = ""
		changes["amendments"] = string(encoded)
	}
	return s.q(ctx).Where("id = ? AND status = ?", a.ID, StatusApproved).Updates(changes).Error
}

type appliedStep struct {
	At   string `json:"at"`
	By   string `json:"by"`
	Step string `json:"step"`
}

func (s *Store) RecordApplied(ctx context.Context, id, by string, steps []string) (Approval, error) {
	stamp := now()
	record := make([]appliedStep, 0, len(steps))
	for _, step := range steps {
		record = append(record, appliedStep{At: stamp, By: by, Step: step})
	}
	encoded, err := json.Marshal(record)
	if err != nil {
		return Approval{}, err
	}
	res := s.q(ctx).Where("id = ? AND status = ?", id, StatusApproved).Update("applied", string(encoded))
	if res.Error != nil {
		return Approval{}, res.Error
	}
	if res.RowsAffected == 0 {
		return Approval{}, ErrNotFound
	}
	return s.Get(ctx, id)
}
