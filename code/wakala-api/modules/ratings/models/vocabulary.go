package models

type Kind string

const (
	KindRater Kind = "rater"
	KindItem  Kind = "item"
)

type Metric string

const (
	MetricEuclidean Metric = "euclidean"
	MetricCosine    Metric = "cosine"
	MetricJaccard   Metric = "jaccard"
)
