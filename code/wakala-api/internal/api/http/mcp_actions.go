package http

func LocalActions() map[string]string {
	return map[string]string{
		"agency_create_instance":    "instance.instance.create",
		"agency_list_instances":     "instance.instance.list",
		"agency_add_agent":          "instance.agent.add",
		"agency_get_my_roles":       "instance.my_roles.read",
		"agency_list_my_open_steps": "instance.my_open_steps.read",
		"agency_grant_service":      "instance.service.grant",
		"agency_list_services":      "instance.service.list",
		"agency_revoke_service":     "instance.service.revoke",
		"agency_design_from_spec":   "agency.design.from_spec",
		"agency_list_types":         "agency.type.list",
		"catalog_template_mint":     "catalog.template.mint",
		"insight_create":            "insight.insight.create",
		"insight_list":              "insight.insight.list",
	}
}
