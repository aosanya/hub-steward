package http

import "github.com/aosanya/mwanachama-backend-agency/models"

type proposedFieldCode struct {
	Record string `json:"record"`
	Key    string `json:"key"`
	Prompt string `json:"prompt"`
	Code   string `json:"code"`
}

func (im *importer) noteProposedFieldCodes(asked []models.StepQuestion, created models.Record) {
	for i, field := range created.Questions {
		if i < len(asked) && asked[i].Code == "" {
			im.result.FieldCodes = append(im.result.FieldCodes, proposedFieldCode{
				Record: created.Code, Key: field.Key, Prompt: field.Prompt, Code: field.Code,
			})
		}
	}
}
