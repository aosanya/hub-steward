package sources

import "errors"

var (
	ErrSourceNotFound      = errors.New("source not found")
	ErrAnnotationNotFound  = errors.New("annotation not found")
	ErrInvalidSource       = errors.New("invalid source")
	ErrSourceInUse         = errors.New("source in use")
	ErrInvalidAnnotation   = errors.New("invalid annotation")
	ErrInvalidVerification = errors.New("invalid verification")
	ErrUnverifiedCaller    = errors.New("a verification needs a caller to stand behind it")
	ErrInvalidChunk        = errors.New("invalid chunk")
	ErrInvalidDocument     = errors.New("invalid document")
	ErrInvalidQuery        = errors.New("invalid search")
)
