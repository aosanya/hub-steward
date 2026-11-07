package agencies

import "errors"

var (
	ErrMarketMountRequired = errors.New("agencies: market mount required")
	ErrMarketNameRequired  = errors.New("agencies: this agency runs more than one market, name the market")
)

const (
	MountDirectory = "directory"

	MountBoard = "board"

	MountSources = "sources"

	MountAssets = "assets"

	MountPolls = "polls"

	MountMarket = "market"

	MountRisks = "risks"

	MountCustody = "custody"

	MountTwin = "twin"

	MountPosts = "posts"
)
