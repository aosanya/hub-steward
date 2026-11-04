package models

import "time"

func NowRFC3339() string { return time.Now().UTC().Format(time.RFC3339Nano) }
