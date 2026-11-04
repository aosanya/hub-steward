package agencies

import (
	"context"
	"strings"
)

func (r *registry) SetKind(ctx context.Context, instanceID, kind string) (Instance, error) {
	if _, err := r.GetInstance(ctx, instanceID); err != nil {
		return Instance{}, err
	}
	err := r.db.WithContext(ctx).Model(&instanceRow{}).
		Where("id = ?", instanceID).Update("kind", strings.TrimSpace(kind)).Error
	r.tenantChanged(instanceID)
	if err != nil {
		return Instance{}, err
	}
	return r.GetInstance(ctx, instanceID)
}
