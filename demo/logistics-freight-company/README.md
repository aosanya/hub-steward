# Meridian Freight & Logistics

A freight logistics company: warehouse & distribution, fleet & transportation, customs & trade compliance, and customer service.

A sample agency for Mwanachama-Wakala: a freight logistics company. It is synthetic and illustrative, not a real organization.

Where it sits: one of the eight synthetic demo agencies ([demo index](../README.md)), a general organization template beside the Siaya computer lab. Unlike the lab it has no documents. Everything in it is invented.

[agency.json](agency.json) imports with `POST /instances/import`.

## Roles

- VP of Operations
- Warehouse Manager
- Inventory Control Supervisor
- Fleet Manager
- Dispatcher
- Customs Compliance Officer
- Trade Documentation Specialist
- Customer Service Manager
- Freight Claims Handler
- Driver/Courier
- Risk owner

## Goals

- Move every shipment on time with an unbroken chain of custody
- Clear customs and trade compliance without delay or penalty
- Resolve customer shipment issues and claims fairly
- Keep known risks controlled

## Workflows

- Inbound & Warehouse Handling
- Dispatch & Delivery
- Customs & Trade Documentation
- Customer Claims Resolution
- Risk review

## Modules on

- auth
- taskmanager
- agency
- actor
- custody
- forms

## Key risks

Illustrative. The API can mount the risk manager, but this template does not switch it on, so no risk register is served here. The Risk owner role holds `risk.read` and works through the risks in the Risk review workflow.

| Threat | Consequence | Preventive measure | Mitigating measure |
|---|---|---|---|
| Cargo theft or tampering in transit | Lost freight, claims and a customer who stops shipping | Signed chain-of-custody handoff, seal check at pickup, caged staging for high-value goods (RU-1, RU-4, RU-7) | Trace the custody trail at once, file the police report, open the claim within 2 business days (RU-3) |
| Customs hold from a wrong tariff code or missing paperwork | Delay, storage fees and penalties | Paperwork prepared before departure, tariff code checked by the compliance officer (RU-2) | Corrected code re-filed within 24 hours, broker coordinates release |
| Vehicle breakdown or accident on a route | Missed delivery window and damaged goods | No route for a vehicle with an overdue inspection (RU-5) | Dispatcher reassigns the load to a spare vehicle and tells the customer |
| Shipping restricted goods or a sanctioned party | Seizure, fines and loss of customs standing | Screening before acceptance (RU-6) | Hold the shipment, notify the compliance officer, report as the law requires |
| Control gaps that nobody reviews | Known threats stay open and repeat | Monthly Risk review by the Risk owner (RU-8) | Each gap becomes a work item with an owner and a 30-day date |
