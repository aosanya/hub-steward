package mwanachamacatalog

import (
	"context"
	"strings"

	"wakalaserver/modules/catalog/models"
)

const routingSetting = "routing"

const (
	DepartmentByRule    = "rule"
	DepartmentByOfficer = "officer"
)

func (m *catalogManager) routing(ctx context.Context) (models.Routing, error) {
	if _, declared := m.spec.Setting(routingSetting); !declared {
		return models.Routing{}, nil
	}
	return resolveFitting(ctx, m, routingSetting, models.ParseRouting)
}

func (m *catalogManager) departmentOf(ctx context.Context, r RaisedItem) (string, string, error) {
	if typed := strings.TrimSpace(r.Department); typed != "" {
		return typed, DepartmentByOfficer, nil
	}
	routing, err := m.routing(ctx)
	if err != nil {
		return "", "", err
	}
	if routed := routing.DepartmentFor(r.Topic); routed != "" {
		return routed, DepartmentByRule, nil
	}
	return "", "", nil
}

func (m *catalogManager) ReassignRaisedItem(ctx context.Context, raisedItemID, department string) error {
	if !m.takesRaisedItems() {
		return ErrRaisedItemsNotTaken
	}
	department = strings.TrimSpace(department)
	if raisedItemID == "" || department == "" {
		return ErrInvalidRaisedItem
	}
	if err := plainText(ErrInvalidRaisedItem, "department", department); err != nil {
		return err
	}
	res := m.q(ctx, roleRaisedItem).Where("id = ?", raisedItemID).Updates(map[string]any{"department": department, "department_by": DepartmentByOfficer})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrRaisedItemNotFound
	}
	return nil
}

func (m *catalogManager) statusOf(ctx context.Context, r RaisedItem) (string, error) {
	if r.BoardItemID == "" || !m.keepsBoard() {
		return StatusReceived, nil
	}
	var b BoardItem
	if err := m.take(m.q(ctx, roleBoardItem).Where("id = ?", r.BoardItemID), roleBoardItem, &b, ErrBoardItemNotFound); err != nil {
		if err == ErrBoardItemNotFound {
			return StatusReceived, nil
		}
		return "", err
	}
	switch {
	case b.ClosedAt != "":
		return StatusClosed, nil
	case b.Outcome != "":
		return b.Outcome, nil
	}
	return StatusOpen, nil
}

const (
	StatusReceived = "received"
	StatusOpen     = "open"
	StatusClosed   = "closed"
)
