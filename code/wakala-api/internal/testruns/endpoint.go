package testruns

import (
	"strings"

	agencymodels "wakalaserver/modules/agency/models"
)

type endpointRule struct {
	words    []string
	endpoint string
}

var marketRules = []endpointRule{
	{[]string{"post", "price"}, "market_create_offer"},
	{[]string{"sell", "now"}, "market_ask"},
	{[]string{"offer", "harvest"}, "market_ask"},
	{[]string{"accept"}, "market_answer_ask"},
	{[]string{"answer", "ask"}, "market_answer_ask"},
	{[]string{"start", "group", "order"}, "market_start_group_order"},
	{[]string{"fill", "order"}, "market_join_group_order"},
	{[]string{"join"}, "market_join_group_order"},
	{[]string{"send", "order"}, endpointSendGroupOrder},
	{[]string{"confirm", "order"}, "market_promise_group_order"},
	{[]string{"promise"}, "market_promise_group_order"},
}

var kindEndpoints = map[agencymodels.StepKind]string{
	agencymodels.StepKindFillForm: endpointAnswerSubmit,
	agencymodels.StepKindYesNo:    endpointAnswerSubmit,
	agencymodels.StepKindSendForm: endpointFormPublish,
	agencymodels.StepKindRoute:    endpointAnswerList,
	agencymodels.StepKindNotify:   endpointMessagePost,
}

func derivedEndpoint(block agencymodels.ScenarioBlock) string {
	text := strings.ToLower(block.Title + " " + block.Action)
	for _, rule := range marketRules {
		if hasAll(text, rule.words) {
			return rule.endpoint
		}
	}
	return kindEndpoints[block.Kind]
}

func hasAll(text string, words []string) bool {
	for _, w := range words {
		if !strings.Contains(text, w) {
			return false
		}
	}
	return true
}

func endpointOf(block agencymodels.ScenarioBlock) string {
	if block.Tool != "" {
		return block.Tool
	}
	return derivedEndpoint(block)
}

var shopEndpoints = map[string]bool{
	"market_create_offer":        true,
	"market_promise_group_order": true,
}

func supplierHint(blocks []agencymodels.ScenarioBlock, block agencymodels.ScenarioBlock) string {
	if endpointOf(block) != "market_start_group_order" {
		return ""
	}
	for _, other := range blocks {
		if endpointOf(other) == "market_promise_group_order" && other.Actor != "" {
			return "The supplier of this order is the shop \"" + other.Actor + "\": use its poster_id."
		}
	}
	return ""
}

func ActorsActingAsShops(blocks []agencymodels.ScenarioBlock) map[string]bool {
	out := map[string]bool{}
	for _, block := range blocks {
		if shopEndpoints[endpointOf(block)] {
			out[block.Actor] = true
		}
	}
	return out
}
