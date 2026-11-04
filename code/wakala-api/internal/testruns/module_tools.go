package testruns

import (
	"sync"

	mwanachamacomm "wakalaserver/modules/comm"
	commroutes "wakalaserver/modules/comm/routes"
	mwanachamaforms "wakalaserver/modules/forms"
	formsroutes "wakalaserver/modules/forms/routes"
	"wakalaserver/modules/shared/dispatch"

	mwanachamaai "wakalaserver/modules/ai"
)

type formsShape struct{ mwanachamaforms.FormManager }

var formsShapeTools = sync.OnceValues(func() ([]dispatch.Tool, error) {
	return formsroutes.BuildGatedTools(formsShape{}, formsroutes.Mount{})
})

var commShapeTools = sync.OnceValues(func() ([]dispatch.Tool, error) {
	s, err := dispatch.Parse(mwanachamacomm.Operations())
	if err != nil {
		return nil, err
	}
	return dispatch.Tools(s, dispatch.Deps{Manager: (*mwanachamacomm.CommManager)(nil), Errors: commroutes.Sentinels})
})

func (s *RunStage) moduleTools(allowed map[string]bool) []mwanachamaai.ChatTool {
	var out []mwanachamaai.ChatTool
	for module, shape := range map[string]func() ([]dispatch.Tool, error){moduleForms: formsShapeTools, moduleComm: commShapeTools} {
		if _, on := s.Modules[module]; !on {
			continue
		}
		tools, err := shape()
		if err != nil {
			continue
		}
		for _, t := range tools {
			if allowed[t.Action] {
				out = append(out, chatToolOf(t.Name, t.Description, t.InputSchema))
			}
		}
	}
	return out
}
