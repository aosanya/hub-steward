# Highline Electric Grid Utility

An electric power utility: generation operations, transmission & grid control, distribution operations, and grid reliability & compliance.

A sample agency for Mwanachama-Wakala: an electric grid utility. It is synthetic and illustrative, not a real organization.

Where it sits: one of the eight synthetic demo agencies ([demo index](../README.md)), a general organization template beside the Siaya computer lab. Unlike the lab it has no documents. Everything in it is invented.

[agency.json](agency.json) imports with `POST /instances/import`.

## Roles

- Chief Operating Officer
- Generation Plant Manager
- Transmission Operations Manager
- Grid Control Room Operator
- Distribution Operations Manager
- Line Crew Supervisor
- Reliability & Compliance Officer
- SCADA/Protection Engineer
- Outage Management Coordinator
- Safety Officer
- Risk owner

## Goals

- Keep the grid stable and within reliability standards
- Restore outages quickly and safely
- Maintain generation, transmission, and distribution assets proactively
- Know and control the utility's key risks

## Workflows

- Grid Monitoring & Reliability Compliance
- Outage Detection & Restoration
- Asset Maintenance
- Equipment Failure Investigation
- Risk review

## Modules on

- auth
- taskmanager
- agency
- actor
- comm
- digitaltwin

## Key risks

The API can mount the risk manager, but this template does not switch it on, so no risk register is served here. Risks are carried by the Risk owner role (holds `risk.read`), the Risk review workflow and the risk rules RU-4 to RU-9.

| Threat | Consequence | Preventive measure | Mitigating measure |
|---|---|---|---|
| Storm damage to transmission lines | Regional outage, long restoration | Annual vegetation clearance (RU-8), asset registry upkeep | Patrol before re-energizing (RU-4), line crews dispatched under lockout/tagout (RU-1) |
| Cyber attack on SCADA and protection relays | Loss of control, possible cascading trip | Multi-factor sign-in, no remote relay access outside a logged window (RU-5) | Manual control procedures rehearsed in contingency drills |
| Failure of a critical transformer | Outage over 4 hours, long replacement lead time | Oil sampling at each maintenance interval (RU-6) | Tested spare or mutual-aid loan, root-cause investigation (RU-3) |
| Blackstart failure after a system collapse | Extended total outage | Scheduled blackstart drills | Corrective action before the next drill (RU-7) |
| Missed regulator reporting deadline | Penalties and loss of standing | Compliance calendar, report compiled from monitoring data (RU-2) | Filed exception and early notice to the regulator |
