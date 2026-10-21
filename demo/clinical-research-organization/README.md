# Meridian Clinical Research

A contract research organization (CRO) running sponsor-outsourced clinical trials for pharmaceutical and biotech clients across the full study lifecycle: protocol/site feasibility, site initiation, informed-consent and case-report-form collection, adverse-event reporting, GCP monitoring visits, data integrity, and regulatory submission packages.

A sample agency for Mwanachama-Wakala: a clinical research organization. It is synthetic and illustrative, not a real organization.

Where it sits: one of the eight synthetic demo agencies ([demo index](../README.md)), a general organization template beside the Siaya computer lab. Unlike the lab it has no documents. Everything in it is invented.

[agency.json](agency.json) imports with `POST /instances/import`.

## Roles

- VP, Clinical Operations
- Clinical Project Manager
- Feasibility & Site Selection Lead
- Site Start-Up Specialist
- Senior Clinical Research Associate (Lead CRA)
- Clinical Research Associate (CRA / Monitor)
- Data Manager
- Biostatistician
- Regulatory Affairs Manager
- Pharmacovigilance & Safety Officer
- GCP Quality Assurance & Compliance Auditor
- Clinical Trial Assistant (CTA)
- Risk owner

## Goals

- Pass every sponsor and regulatory audit with an inspection-ready Trial Master File
- Start up and activate sites on schedule across every study
- Protect patient safety through timely adverse-event detection and reporting

## Workflows

- Site Feasibility & Initiation
- Trial Monitoring & Data Management
- Adverse Event & Safety Reporting
- Regulatory Submission & Audit Readiness
- Risk review

## Modules on

- auth
- taskmanager
- actor
- custody
- forms

## Key risks

The API can mount the risk manager, but this template does not switch it on, so no risk register is served here. The Risk owner role holds `risk.read`, the Risk review workflow runs the quarterly pass, and rules RU-5 to RU-10 carry the measures.

| Threat | Consequence | Preventive measure | Mitigating measure |
| --- | --- | --- | --- |
| A serious adverse event is reported late | Missed 24 hour or 15 day regulatory clock; sponsor and regulator findings; subject safety exposed | RU-5: triage within 4 working hours, SAE clock log | Escalation to the VP, Clinical Operations; late-report explanation filed with the sponsor and a CAPA opened |
| A site enrols before it is activated | Data from unprotected subjects; protocol deviation; data may be excluded from the submission | RU-6: two-signature activation checklist, enrolment blocked in the EDC | Deviation reported to the sponsor and IRB; affected subjects reviewed; site retrained |
| eCRF data is changed without a trace | Loss of data integrity; a study readout or inspection fails | RU-7: reason and user on every change, monthly audit trail review | Reconciliation against source; the Biostatistician excludes unverified data until it is resolved |
| A subject is consented on an old form | Invalid consent; ethics finding; subject data unusable | RU-8: only the IRB-approved version in use, version checked at filing | 100% consent form verification at the next visit; re-consent of affected subjects |
| Monitoring findings go stale | Repeated deficiencies; critical audit finding; Trial Master File gaps at inspection | RU-9: a CAPA within 5 working days, closure needs evidence | Quarterly Risk review reopens thin CAPAs and escalates overdue ones |
