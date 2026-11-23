package testruns

import (
	"testing"

	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

func TestEndpointOfPrefersTheBlocksOwnTool(t *testing.T) {
	block := agencymodels.ScenarioBlock{Tool: "custom_tool", Title: "Post the price", Kind: agencymodels.StepKindFillForm}
	if got := endpointOf(block); got != "custom_tool" {
		t.Fatalf("endpointOf = %q, want custom_tool", got)
	}
}

func TestDerivedEndpointReadsTitleAndActionCaseInsensitively(t *testing.T) {
	cases := []struct {
		name  string
		block agencymodels.ScenarioBlock
		want  string
	}{
		{"post and price in the title", agencymodels.ScenarioBlock{Title: "Post the PRICE list"}, "market_create_offer"},
		{"words split across title and action", agencymodels.ScenarioBlock{Title: "Sell", Action: "available NOW"}, "market_ask"},
		{"offer harvest", agencymodels.ScenarioBlock{Action: "Offer the harvest"}, "market_ask"},
		{"accept", agencymodels.ScenarioBlock{Title: "Accept the offer"}, "market_answer_ask"},
		{"answer ask", agencymodels.ScenarioBlock{Title: "Answer the ask"}, "market_answer_ask"},
		{"start group order", agencymodels.ScenarioBlock{Title: "Start a group order"}, "market_start_group_order"},
		{"fill order", agencymodels.ScenarioBlock{Title: "Fill the order"}, "market_join_group_order"},
		{"join", agencymodels.ScenarioBlock{Title: "Join"}, "market_join_group_order"},
		{"send order", agencymodels.ScenarioBlock{Title: "Send the order"}, "market_send_group_order"},
		{"confirm order", agencymodels.ScenarioBlock{Title: "Confirm order"}, "market_promise_group_order"},
		{"promise", agencymodels.ScenarioBlock{Action: "promise delivery"}, "market_promise_group_order"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := derivedEndpoint(c.block); got != c.want {
				t.Fatalf("derivedEndpoint = %q, want %q", got, c.want)
			}
		})
	}
}

func TestDerivedEndpointFallsBackToTheStepKind(t *testing.T) {
	cases := map[agencymodels.StepKind]string{
		agencymodels.StepKindFillForm: endpointAnswerSubmit,
		agencymodels.StepKindYesNo:    endpointAnswerSubmit,
		agencymodels.StepKindSendForm: endpointFormPublish,
		agencymodels.StepKindRoute:    endpointAnswerList,
		agencymodels.StepKindNotify:   endpointMessagePost,
	}
	for kind, want := range cases {
		block := agencymodels.ScenarioBlock{Title: "Something plain", Kind: kind}
		if got := derivedEndpoint(block); got != want {
			t.Errorf("kind %s: endpoint = %q, want %q", kind, got, want)
		}
	}
}

func TestDerivedEndpointIsEmptyForAKindWithNoEndpoint(t *testing.T) {
	block := agencymodels.ScenarioBlock{Title: "Think", Kind: agencymodels.StepKindCompute}
	if got := derivedEndpoint(block); got != "" {
		t.Fatalf("derivedEndpoint = %q, want empty", got)
	}
}

func TestDerivedEndpointFirstMatchingRuleWins(t *testing.T) {
	block := agencymodels.ScenarioBlock{Title: "Post the price and join"}
	if got := derivedEndpoint(block); got != "market_create_offer" {
		t.Fatalf("derivedEndpoint = %q, want market_create_offer", got)
	}
}

func TestSupplierHintNamesTheShopThatPromisesTheOrder(t *testing.T) {
	start := agencymodels.ScenarioBlock{Title: "Start a group order", Actor: "Neighbour"}
	promise := agencymodels.ScenarioBlock{Title: "Promise the order", Actor: "Corner Shop"}
	got := supplierHint([]agencymodels.ScenarioBlock{start, promise}, start)
	want := "The supplier of this order is the shop \"Corner Shop\": use its poster_id."
	if got != want {
		t.Fatalf("hint = %q, want %q", got, want)
	}
}

func TestSupplierHintIsEmptyWhenTheBlockDoesNotStartAnOrder(t *testing.T) {
	join := agencymodels.ScenarioBlock{Title: "Join the order", Actor: "Neighbour"}
	promise := agencymodels.ScenarioBlock{Title: "Promise the order", Actor: "Corner Shop"}
	if got := supplierHint([]agencymodels.ScenarioBlock{join, promise}, join); got != "" {
		t.Fatalf("hint = %q, want empty", got)
	}
}

func TestSupplierHintIsEmptyWhenNoPromiseNamesAnActor(t *testing.T) {
	start := agencymodels.ScenarioBlock{Title: "Start a group order", Actor: "Neighbour"}
	promise := agencymodels.ScenarioBlock{Title: "Promise the order"}
	if got := supplierHint([]agencymodels.ScenarioBlock{start, promise}, start); got != "" {
		t.Fatalf("hint = %q, want empty", got)
	}
	if got := supplierHint([]agencymodels.ScenarioBlock{start}, start); got != "" {
		t.Fatalf("hint with no promise = %q, want empty", got)
	}
}

func TestActorsActingAsShopsCollectsOfferersAndPromisers(t *testing.T) {
	blocks := []agencymodels.ScenarioBlock{
		{Title: "Post the price", Actor: "Stall"},
		{Title: "Promise the order", Actor: "Corner Shop"},
		{Title: "Join the order", Actor: "Neighbour"},
		{Title: "Anything", Tool: "market_create_offer", Actor: "Kiosk"},
	}
	got := ActorsActingAsShops(blocks)
	if len(got) != 3 || !got["Stall"] || !got["Corner Shop"] || !got["Kiosk"] {
		t.Fatalf("shops = %v, want Stall, Corner Shop and Kiosk only", got)
	}
	if got["Neighbour"] {
		t.Fatalf("a person who only joins must not be a shop: %v", got)
	}
}

func TestActorsActingAsShopsIsEmptyForNoBlocks(t *testing.T) {
	if got := ActorsActingAsShops(nil); got == nil || len(got) != 0 {
		t.Fatalf("shops = %v, want an empty non-nil map", got)
	}
}
