package templates

type Spec struct {
	Slug         string `json:"slug"`
	Name         string `json:"name"`
	Summary      string `json:"summary,omitempty"`
	Description  string `json:"description,omitempty"`
	Sector       string `json:"sector,omitempty"`
	Archetype    string `json:"archetype,omitempty"`
	ResearchMode string `json:"research_mode,omitempty"`

	Roles      []Role      `json:"roles,omitempty"`
	Goals      []Goal      `json:"goals,omitempty"`
	Objectives []Objective `json:"objectives,omitempty"`
	Workflows  []Workflow  `json:"workflows,omitempty"`
	WorkItems  []WorkItem  `json:"work_items,omitempty"`
	RACI       []RACI      `json:"raci,omitempty"`
	Controls   []Statement `json:"controls,omitempty"`
	Modules    []Module    `json:"modules,omitempty"`

	Readme        string         `json:"readme,omitempty"`
	Sales         string         `json:"sales,omitempty"`
	ModuleConfigs map[string]any `json:"module_configs,omitempty"`
}

type Role struct {
	Key         string `json:"key"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

type Goal struct {
	Key         string `json:"key"`
	Title       string `json:"title"`
	Description string `json:"description"`
}

type Objective struct {
	Key         string `json:"key"`
	Goal        string `json:"goal"`
	Title       string `json:"title"`
	Description string `json:"description"`
}

type Workflow struct {
	Key         string   `json:"key"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Objectives  []string `json:"objectives,omitempty"`
}

type WorkItem struct {
	Key         string `json:"key"`
	Workflow    string `json:"workflow"`
	Objective   string `json:"objective,omitempty"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Prompt      string `json:"prompt"`
}

type RACI struct {
	Role     string `json:"role"`
	WorkItem string `json:"work_item"`
	Label    string `json:"label"`
}

type Statement struct {
	Key        string `json:"key"`
	Text       string `json:"text"`
	TargetType string `json:"target_type,omitempty"`
	TargetKey  string `json:"target_key,omitempty"`
}

type Module struct {
	Code string `json:"code"`
}
