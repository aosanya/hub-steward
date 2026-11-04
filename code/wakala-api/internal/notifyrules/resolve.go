package notifyrules

type Roster map[Audience][]string

func Resolve(r Rule, in Roster) []string {
	if told := gather(r.Told, in); len(told) > 0 {
		return told
	}
	return gather(r.Fallback, in)
}

func gather(audiences []Audience, in Roster) []string {
	seen := map[string]bool{}
	out := []string{}
	for _, a := range audiences {
		for _, id := range in[a] {
			if id == "" || seen[id] {
				continue
			}
			seen[id] = true
			out = append(out, id)
		}
	}
	return out
}
