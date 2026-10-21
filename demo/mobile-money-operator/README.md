# Mobile Money Operator

A telco-led mobile money service running a super-agent/sub-agent distribution network, AML/KYC compliance, and customer money-transfer operations — modeled on the M-PESA/MTN MoMo/Airtel Money shape.

A sample agency for Mwanachama-Wakala: a mobile money operator. It is synthetic and illustrative, not a real organization.

Where it sits: one of the eight synthetic demo agencies ([demo index](../README.md)), a general organization template beside the Siaya computer lab. Unlike the lab it has no documents. Everything in it is invented.

[agency.json](agency.json) imports with `POST /instances/import`.

## Roles

- Managing Director
- Head of Agent Network
- Agent Network Manager (Regional)
- Compliance & AML Officer
- KYC Analyst
- Customer Operations Manager
- Customer Care Agent
- Head of Technology & Platform
- Fraud & Risk Analyst
- Risk owner (holds risk.read)

## Goals

- Grow and govern a compliant agent network
- Protect the platform from fraud and financial crime
- Deliver reliable, trusted money-transfer service

## Workflows

- Agent Onboarding & Vetting
- Transaction Monitoring & SAR Filing
- Customer Complaint Resolution
- Platform Incident Response
- Risk review

## Modules on

- auth
- actor
- comm
- custody
- forms
- accounting

The task manager is not switched on, although the template has workflows.

## Key risks

The API can mount the risk manager, but this template does not switch it on, so no risk register is served here. The Risk owner role holds `risk.read`, the Risk review workflow walks the list, and rules RU-4 to RU-9 carry the controls. Illustrative.

| Threat | Consequence | Preventive measure | Mitigating measure |
|---|---|---|---|
| Agent collusion or float theft | Customer money lost, agent trust broken | Agent vetting before activation (RU-1), daily float reconciliation (RU-6) | Suspend the agent, reverse affected transfers, retrain the network |
| SIM-swap account takeover | A customer's wallet emptied | Second verification after a SIM swap (RU-5) | Freeze the wallet, trace the transfer, refund under the complaint workflow |
| Missed suspicious transaction | Licence penalty, money laundering through the platform | New-account limits until KYC is done (RU-4), monitoring alerts | File the STR late with a reason, review the alert rules |
| Platform outage | Transactions fail, customers lose trust | Quarterly failover test, uptime dashboard (RU-7) | Declare the incident, fail over, run the post-incident review |
| Leak of customer ID documents | Identity fraud, data-protection fine | Only the KYC Analyst opens documents, every access logged (RU-8) | Notify the regulator and customers, rotate access, audit the log |
