package agencies

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const SystemTagName = "all"

var (
	ErrTagInvalid   = errors.New("agencies: a tag needs an instance and a name")
	ErrTagNameTaken = errors.New("agencies: a tag with that name already exists in this instance")
	ErrTagNotFound  = errors.New("agencies: tag not found in this instance")
	ErrSystemTag    = errors.New("agencies: the system tag all cannot be renamed or deleted")
	ErrTagInUse     = errors.New("agencies: the tag is still carried")
)

type TagInUseError struct {
	Groups int
	Rows   int
}

func (e *TagInUseError) Error() string {
	return fmt.Sprintf("agencies: the tag is still carried by %d group(s) and %d row(s)", e.Groups, e.Rows)
}

func (e *TagInUseError) Is(target error) bool { return target == ErrTagInUse }

type Tag struct {
	ID         string    `json:"id"`
	InstanceID string    `json:"instance_id"`
	Name       string    `json:"name"`
	System     bool      `json:"system"`
	CreatedAt  time.Time `json:"created_at"`
}

type TagRowCounter func(ctx context.Context, instanceID, tagID string) (int, error)

type Tags interface {
	ListTags(ctx context.Context, instanceID string) ([]Tag, error)
	CreateTag(ctx context.Context, instanceID, name string) (Tag, error)
	RenameTag(ctx context.Context, instanceID, tagID, name string) (Tag, error)
}

type tagRow struct {
	ID         string `gorm:"primaryKey"`
	InstanceID string `gorm:"uniqueIndex:agency_tags_instance_name"`
	Name       string `gorm:"uniqueIndex:agency_tags_instance_name"`
	System     bool
	CreatedAt  time.Time
}

func (tagRow) TableName() string { return "agency_tags" }

func migrateTags(db *gorm.DB) error {
	return db.AutoMigrate(&tagRow{})
}

func WithTagRowCounter(count TagRowCounter) Option {
	return func(r *registry) { r.tagRows = count }
}

func tagOf(row tagRow) Tag {
	return Tag{ID: row.ID, InstanceID: row.InstanceID, Name: row.Name, System: row.System, CreatedAt: row.CreatedAt}
}

func (r *registry) ensureSystemTag(ctx context.Context, instanceID string) error {
	row := tagRow{ID: uuid.New().String(), InstanceID: instanceID, Name: SystemTagName, System: true, CreatedAt: time.Now().UTC()}
	return r.db.WithContext(ctx).Clauses(clause.OnConflict{DoNothing: true}).Create(&row).Error
}

func (r *registry) tagsOfKnownInstance(ctx context.Context, instanceID string) error {
	if blank(instanceID) {
		return ErrInstanceNotFound
	}
	if _, err := r.readInstance(ctx, instanceID); err != nil {
		return err
	}
	return r.ensureSystemTag(ctx, instanceID)
}

func (r *registry) ListTags(ctx context.Context, instanceID string) ([]Tag, error) {
	if err := r.tagsOfKnownInstance(ctx, instanceID); err != nil {
		return nil, err
	}
	var rows []tagRow
	err := r.db.WithContext(ctx).Where("instance_id = ?", instanceID).
		Order("system DESC, lower(name), name").Find(&rows).Error
	if err != nil {
		return nil, err
	}
	out := make([]Tag, 0, len(rows))
	for _, row := range rows {
		out = append(out, tagOf(row))
	}
	return out, nil
}

func (r *registry) nameTaken(ctx context.Context, instanceID, name, exceptID string) (bool, error) {
	var taken int64
	err := r.db.WithContext(ctx).Model(&tagRow{}).
		Where("instance_id = ? AND lower(name) = lower(?) AND id <> ?", instanceID, name, exceptID).
		Count(&taken).Error
	return taken > 0, err
}

func (r *registry) CreateTag(ctx context.Context, instanceID, name string) (Tag, error) {
	name = strings.TrimSpace(name)
	if blank(instanceID, name) {
		return Tag{}, ErrTagInvalid
	}
	if err := r.tagsOfKnownInstance(ctx, instanceID); err != nil {
		return Tag{}, err
	}
	taken, err := r.nameTaken(ctx, instanceID, name, "")
	if err != nil {
		return Tag{}, err
	}
	if taken {
		return Tag{}, ErrTagNameTaken
	}
	row := tagRow{ID: uuid.New().String(), InstanceID: instanceID, Name: name, CreatedAt: time.Now().UTC()}
	if err := r.db.WithContext(ctx).Create(&row).Error; err != nil {
		return Tag{}, err
	}
	return tagOf(row), nil
}

func (r *registry) findTag(ctx context.Context, instanceID, tagID string) (tagRow, error) {
	var rows []tagRow
	err := r.db.WithContext(ctx).Where("instance_id = ? AND id = ?", instanceID, tagID).Limit(1).Find(&rows).Error
	if err != nil {
		return tagRow{}, err
	}
	if len(rows) == 0 {
		return tagRow{}, ErrTagNotFound
	}
	return rows[0], nil
}

func (r *registry) RenameTag(ctx context.Context, instanceID, tagID, name string) (Tag, error) {
	name = strings.TrimSpace(name)
	if blank(instanceID, name) {
		return Tag{}, ErrTagInvalid
	}
	if err := r.tagsOfKnownInstance(ctx, instanceID); err != nil {
		return Tag{}, err
	}
	row, err := r.findTag(ctx, instanceID, tagID)
	if err != nil {
		return Tag{}, err
	}
	if row.System {
		return Tag{}, ErrSystemTag
	}
	taken, err := r.nameTaken(ctx, instanceID, name, row.ID)
	if err != nil {
		return Tag{}, err
	}
	if taken {
		return Tag{}, ErrTagNameTaken
	}
	row.Name = name
	if err := r.db.WithContext(ctx).Model(&tagRow{}).Where("id = ?", row.ID).Update("name", name).Error; err != nil {
		return Tag{}, err
	}
	return tagOf(row), nil
}
