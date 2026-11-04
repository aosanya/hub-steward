# Boda boda riders' agency

The riders' group around the planned Siaya hub, written as an agency template
for Mwanachama-Wakala. It holds seven roles: the hub manager, member, rider
and customer, and the three AI roles Hub Steward, Dispatcher and Assets
Keeper. It has four goals, five objectives, who is accountable,
responsible, consulted and informed for each, nine rules, and five workflows:
a ride request, rider availability, assets, answers and
access, and pick a rider.

Where it sits: one of the eight synthetic demo agencies ([demo index](../README.md)),
the riders' group beside the farmers' and the Siaya computer lab. Unlike the lab
it has no documents. Everything in it is invented.

[agency.json](agency.json) imports with `POST /instances/import`. It switches
on comm, taskmanager, forms and market and links each to the
objectives that use it: market to O-1 to O-3. The hub is planned, not open, every person is synthetic, and the
numbers in the rules (five minutes, three riders) are values chosen for the
demo.

Riders own their bikes, so the template allocates no bikes; the Assets Keeper
registers the agency's own equipment through the asset manager.

## The ride form

[forms.json](forms.json) declares the form a customer opens to ask for a ride:
"Ask for a ride", a standing form, so it is open at all times and takes any
number of sends, that lands in a chat thread. It has two
required short-text questions, "Pickup" and "Destination", in English. A send
opens the customer's chat thread, titled with the form, with the answers one
per line as `Pickup: …` and `Destination: …`.

The form is not part of `agency.json`, which only links the forms module to
the ride-request objective. It is created through the Mwanachama forms tools from `forms.json`.

## The role the agents act as

The Hub Steward agents reach an agency as one service the agency's owner links to one
role of this template: Hub Steward. Once linked, Mwanachama lets the agents
make only the calls that role's permissions allow, so the role holds the permissions
they need: `ai.use` (the model, through the AI backend), chat (`chat.post`,
`chat.thread`), forms (`form.compose`, `form.send`, `form.answers.read`),
documents (`document.search`, `document.read`), the lists of rooms and
members (`group.read`, `member.read`) and the market (`market.browse`,
`market.ask`). It holds no `risk.read`. Every agent runs under the same
service, and the console gives every hub the same rooms, so the role carries
the permissions of all of them; narrow the list in `agency.json` for a hub whose
agents do less. Proposing a write for an owner to approve, listing proposals
and amending one need no permission. The Dispatcher and Assets Keeper
roles hold no permissions in this template, and the Rider holds
`market.browse` and `market.offer`.
