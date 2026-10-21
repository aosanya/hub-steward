# 05 · Network watch

Network watch is one capability an agency can switch on: an AI role keeps a picture of the agency's devices in Mwanachama's digital twin, a graph of the things the agency runs and what each one measured over time, and tells the people who look after them when one fails. An agency with nothing to watch leaves it off.

The community computer lab in Siaya is the worked example below. The digital-twin module and a lab example exist. The bundled API in `code/wakala-api` does not carry the module yet: its module list names the twin as an agency module that is off and has no mount. The rest is not built.

## The lab as a twin

| Node | Example readings | Limit that raises an alert |
|---|---|---|
| Terminals | online | offline |
| Access points | online, clients | offline |
| Router | online, throughput | offline; throughput below a floor |
| Servers | online | offline |
| Solar and battery | battery charge | charge below a floor |

Links record what connects to what (a terminal to an access point, an access point to the router), so an alert can say what else a fault takes down. Another agency would declare its own nodes, links and limits in the same shape.

## The flow planned for the demo

```
 simulator ──every minute──▶ record readings ──▶ twin
                                                   │
 AI role ──every minute── read latest ◀────────────┘
      │ a node offline or past its limit
      ├──▶ set the node's status to fault
      └──▶ post in the manager's room
```

The AI role is Hub Steward in the lab. Of the demo agencies, only the boda-boda riders name a Network Watcher role, whose work this is; the electric grid utility and the drone crop-spraying service also switch the digital twin on but name no such role. The simulator is planned to be shaped like the local API of a common router controller: sites, devices and clients, and an outage on demand for the demo. No simulator is in this repository yet.

## Exists and to be built

| Piece | State |
|---|---|
| Nodes, links, metrics with limits, readings over time, latest readings | Built in the digital twin module; not mounted on the bundled API |
| A lab example: devices, wiring, readings and samples, kept 30 days by default, with online, throughput and battery-charge metrics and their limits | Built in the module; readings are not yet checked against limits |
| The twin itself checking a reading against its limits | Not decided; in the demo the AI role makes the check |
| MCP tools for the twin | Built in the module; registered when the twin is mounted |
| The twin mounted per agency | To be built; waits on who may read and write it |
| The simulator | To be built; none is in this repository |

## Open

| Choice | State |
|---|---|
| Where a real agency's readings come from: a router controller's API, or something else | Not chosen; the demo is planned to use a simulator |
| Who may read and write an agency's twin | Not decided |
| Whether the Network Watcher role and Hub Steward stay two roles when both are on | Not decided |
