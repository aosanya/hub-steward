package models

import "strings"

type StepKind string

const (
	StepKindFillForm    StepKind = "fill_form"
	StepKindSendForm    StepKind = "send_form"
	StepKindNotify      StepKind = "notify"
	StepKindYesNo       StepKind = "yes_no"
	StepKindRoute       StepKind = "route"
	StepKindRunWorkflow StepKind = "run_workflow"
	StepKindChat        StepKind = "chat"
)

var stepKinds = []StepKind{
	StepKindFillForm, StepKindSendForm, StepKindNotify,
	StepKindYesNo, StepKindRoute, StepKindRunWorkflow, StepKindChat,
}

func StepKinds() []StepKind { return append([]StepKind(nil), stepKinds...) }

func (k StepKind) Valid() bool {
	for _, known := range stepKinds {
		if k == known {
			return true
		}
	}
	return false
}

func (k StepKind) TakesForm() bool {
	return k == StepKindFillForm || k == StepKindSendForm || k == StepKindNotify || k == StepKindYesNo
}

func (k StepKind) AgencyOnly() bool {
	return k == StepKindSendForm || k == StepKindRoute
}

type AnswerType string

const (
	AnswerYesNo        AnswerType = "yes_no"
	AnswerSingleChoice AnswerType = "single_choice"
	AnswerMultiSelect  AnswerType = "multi_select"
	AnswerFreeText     AnswerType = "free_text"
	AnswerDate         AnswerType = "date"
	AnswerTime         AnswerType = "time"
	AnswerNumber       AnswerType = "number"
	AnswerCurrency     AnswerType = "currency"
	AnswerPhoto        AnswerType = "photo"
	AnswerFile         AnswerType = "file"
)

var answerTypes = []AnswerType{
	AnswerYesNo, AnswerSingleChoice, AnswerMultiSelect, AnswerFreeText,
	AnswerDate, AnswerTime, AnswerNumber, AnswerCurrency,
	AnswerPhoto, AnswerFile,
}

func AnswerTypes() []AnswerType { return append([]AnswerType(nil), answerTypes...) }

func (a AnswerType) HasOptions() bool { return a == AnswerSingleChoice || a == AnswerMultiSelect }

func (a AnswerType) Valid() bool {
	for _, known := range answerTypes {
		if a == known {
			return true
		}
	}
	return false
}

type StepQuestion struct {
	Prompt      string     `json:"prompt"`
	AnswerType  AnswerType `json:"answer_type"`
	Required    bool       `json:"required"`
	Helper      string     `json:"helper,omitempty"`
	Options     []string   `json:"options,omitempty"`
	OptionsFrom string     `json:"options_from,omitempty"`
	Fixed       string     `json:"fixed,omitempty"`
}

type RouteMatch string

const (
	RouteMatchAll RouteMatch = "all"
	RouteMatchAny RouteMatch = "any"
)

func (m RouteMatch) Valid() bool { return m == RouteMatchAll || m == RouteMatchAny }

type RouteOperator string

const (
	RouteIs       RouteOperator = "is"
	RouteIsNot    RouteOperator = "is_not"
	RouteContains RouteOperator = "contains"
	RouteMoreThan RouteOperator = "more_than"
	RouteLessThan RouteOperator = "less_than"
)

var routeOperators = []RouteOperator{RouteIs, RouteIsNot, RouteContains, RouteMoreThan, RouteLessThan}

func RouteOperators() []RouteOperator { return append([]RouteOperator(nil), routeOperators...) }

func (o RouteOperator) Valid() bool {
	for _, known := range routeOperators {
		if o == known {
			return true
		}
	}
	return false
}

func (o RouteOperator) Numeric() bool { return o == RouteMoreThan || o == RouteLessThan }

type RouteRule struct {
	Question string        `json:"question"`
	Operator RouteOperator `json:"operator"`
	Value    string        `json:"value"`
}

type StepRoute struct {
	Match    RouteMatch  `json:"match"`
	Rules    []RouteRule `json:"rules"`
	GoToStep string      `json:"go_to_step_id"`
}

func (wi WorkItem) HasLinks() bool {
	return wi.RecipientRoleID != "" || wi.SentStepID != "" || len(wi.Routes) > 0 || wi.OtherwiseStepID != ""
}

const MaxChatPrompts = 3

func (wi WorkItem) HasChatFields() bool {
	return wi.AgentRoleID != "" || wi.Topic != "" || wi.OpeningLine != "" ||
		len(wi.Prompts) > 0 || len(wi.Tools) > 0 || len(wi.StartWorkflowIDs) > 0
}

func (wi WorkItem) WaitsOnPerson() bool {
	return wi.RoleID != "" && (wi.Kind == StepKindFillForm || wi.Kind == StepKindYesNo)
}

func (wi WorkItem) AnswersSentForm() bool {
	return wi.Kind == StepKindYesNo && wi.SentStepID != ""
}

func AnswerActionOf(sentFormName string) string {
	return "Answers the " + lowerFirst(sentFormName)
}

func lowerFirst(text string) string {
	if text == "" {
		return text
	}
	return strings.ToLower(text[:1]) + text[1:]
}

func ActionOf(kind StepKind, formName, runWorkflowName string) string {
	switch kind {
	case StepKindFillForm:
		return "Fills the " + formName
	case StepKindSendForm:
		return "Sends the " + lowerFirst(formName)
	case StepKindNotify:
		return "Notifies with the " + lowerFirst(formName)
	case StepKindYesNo:
		return "Gives " + lowerFirst(formName)
	case StepKindRoute:
		return "Routes the answers"
	case StepKindRunWorkflow:
		return "Starts " + runWorkflowName
	case StepKindChat:
		return "Chats with an agent"
	}
	return ""
}
