package mwanachamaratings

import "errors"

var ErrInvalidSetting = errors.New("invalid setting")

var ErrSettingNotFound = errors.New("setting not found")

var ErrInvalidRating = errors.New("invalid rating")

var ErrRatingNotFound = errors.New("rating not found")

var ErrInvalidSimilarity = errors.New("invalid similarity")
