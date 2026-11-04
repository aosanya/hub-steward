package throttle

import "time"

const (
	MaxOwnedInstancesPerCaller = 50
	MaxInstanceNameBytes       = 200
	MaxImportEntities          = 1000

	MaxLiveAPIKeysPerAccount = 100
	MaxAPIKeyNameBytes       = 200

	RefusedBearersRemembered = 4096
	RefusedBearerMemory      = 30 * time.Second

	MaxConcurrentPasswordHashes = 4

	SignInTriesPerClient  = 5
	SignInTriesPerAddress = 50
	SignInLockFor         = 15 * time.Minute
	SignInTrackedKeys     = 20000

	AdminTokenTriesPerClient = 10
	AdminTokenLockFor        = 15 * time.Minute
	AdminTokenTrackedClients = 5000
)
