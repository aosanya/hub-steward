# AgroWing Aerial Spraying Services

A commercial drone operator providing precision aerial crop-spraying, seeding and crop-health monitoring services to farms under contract.

A sample agency for Mwanachama-Wakala: an agricultural drone crop-spraying service. It is synthetic and illustrative, not a real organization.

Where it sits: one of the eight synthetic demo agencies ([demo index](../README.md)), a general organization template beside the Siaya computer lab. Unlike the lab it has no documents. Everything in it is invented.

[agency.json](agency.json) imports with `POST /instances/import`.

## Roles

- Chief Pilot
- Fleet Maintenance Technician
- Agronomist / Spray Prescription Specialist
- Client Success Manager
- Compliance & Airspace Officer
- Ground Crew / Flight Support Technician
- Operations Dispatcher
- Finance & Billing Officer
- Data & Mapping Analyst
- Safety Officer
- Risk Owner

## Goals

- Deliver safe, compliant aerial spray operations
- Grow a sustainable, profitable client base
- Maintain full regulatory and safety compliance

## Workflows

- Spray Job Intake & Flight Planning
- Flight Execution & Field Operations
- Fleet Maintenance & Airworthiness
- Billing & Compliance Reporting
- Risk review

## Key risks

Risks are carried by a Risk Owner role that holds `risk.read`, the Risk review workflow, and the rules RU-5 to RU-10. The API can mount the risk manager, but this template does not switch it on, so each risk is summarised here as a bow-tie.

| Threat | Consequence | Preventive measure | Mitigating measure |
|---|---|---|---|
| Spray drift onto a neighbouring farm, home or water body | Crop damage claims, contaminated water, loss of the client and the permit | Wind and buffer limits checked before every flight (RU-2, RU-5); field boundary confirmed against the authorization | Abort and land on a wind trigger; same-day incident report; insurance and a written notice to the neighbour |
| Loss of control or fly-away over people or roads | Injury to a person, a damaged aircraft, a regulator investigation | Pre-flight airworthiness checklist (RU-1); safety radius kept clear (RU-6); GPS lock confirmed | Return-to-land failsafe; ground crew spotter; incident logged and the airframe grounded until repaired |
| Lithium battery fire during charging or transport | Fire in the workshop or vehicle, injury, lost fleet capacity | Fireproof charging area, no unattended charging, swollen packs retired (RU-7) | Fire blanket and extinguisher at the charging area; storage in separate containers |
| Lapsed pilot licence or aircraft registration | Flights are illegal, insurance is void, jobs are cancelled | Expiry dates tracked and renewal started 30 days early; a lapsed pilot or airframe is grounded (RU-8) | A second licensed pilot named for each region; affected jobs rescheduled by the dispatcher |
| Pesticide spill or operator exposure while mixing and loading | Poisoned crew member, contaminated soil or water, fines | Protective equipment and mixing procedure (RU-9); label rates only | Spill kit on the vehicle; quarterly spill-response drill; same-day report to the Safety Officer |

## Modules on

- auth
- actor
- forms
- digitaltwin
- accounting

The task manager is not switched on, although the template has workflows.
