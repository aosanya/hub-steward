package mwanachamaratings

import (
	"math"

	"wakalaserver/modules/ratings/models"
)

type valuePair struct {
	mine   float64
	theirs float64
}

type ratedCounts struct {
	mine   int
	theirs int
}

type metricFunc func(shared []valuePair, counts ratedCounts) float64

func metricFor(m Metric) metricFunc {
	switch m {
	case models.MetricCosine:
		return cosine
	case models.MetricJaccard:
		return jaccard
	default:
		return euclidean
	}
}

func euclidean(shared []valuePair, _ ratedCounts) float64 {
	var sum float64
	for _, p := range shared {
		d := p.mine - p.theirs
		sum += d * d
	}
	return 1 / (1 + math.Sqrt(sum))
}

func cosine(shared []valuePair, _ ratedCounts) float64 {
	var dot, mine, theirs float64
	for _, p := range shared {
		dot += p.mine * p.theirs
		mine += p.mine * p.mine
		theirs += p.theirs * p.theirs
	}
	if mine == 0 || theirs == 0 {
		return 0
	}
	return math.Min(1, math.Max(0, dot/(math.Sqrt(mine)*math.Sqrt(theirs))))
}

func jaccard(shared []valuePair, counts ratedCounts) float64 {
	both := len(shared)
	either := counts.mine + counts.theirs - both
	if either <= 0 {
		return 0
	}
	return float64(both) / float64(either)
}
