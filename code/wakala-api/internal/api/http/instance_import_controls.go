package http

func (in importRequest) controls() []importControl {
	out := append([]importControl(nil), in.Controls...)
	for _, statements := range [][]importStatement{in.Values, in.Rules} {
		for _, st := range statements {
			out = append(out, importControl{ID: st.ID, Code: st.Code, Text: st.Text})
		}
	}
	return out
}

func (in importRequest) controlAttachments() []importAttachment {
	out := append([]importAttachment(nil), in.ControlAttachments...)
	for _, legacy := range [][]importAttachment{in.ValueAttachments, in.RuleAttachments} {
		for _, a := range legacy {
			a.ControlCode = firstNonEmpty(a.ControlCode, a.ValueCode, a.RuleCode)
			a.ControlID = firstNonEmpty(a.ControlID, a.ValueID, a.RuleID)
			out = append(out, a)
		}
	}
	return out
}
