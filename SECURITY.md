# Security policy

## Reporting a vulnerability

Report it privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability** (a private security advisory). Please do not open a public issue or pull request for a vulnerability.

Include what you found, the steps to reproduce it, the version or commit, and what an attacker could do with it.

## What is in scope

- Agent keys and model API keys: any way to read, leak, log or reuse one.
- Member data: any way for one hub's or one member's data to reach someone it should not.
- The approval flow: any way for the agent, a member or a script to carry out an action that a manager has not approved.
- The bundled `wakala-api` in `code/wakala-api`: authentication, sessions, authorisation, injection, and request handling.
- The console and the phone app: cross-site scripting, request forgery, and unsafe handling of the settings they read.

## What is out of scope

- The demo organisations, people, numbers and addresses in `demo/`. They are invented.
- Findings that need a model's output to be trusted blindly with no approval step in the way, unless they get around an approval.
- Denial of service by sending large volumes of traffic.
- Problems in a third-party dependency that are not reachable from this code. Report those upstream.

## What to expect

This is a small open-source project maintained in spare time. We aim to acknowledge a report within a week and to tell you what we plan to do within a few weeks. We will credit you in the advisory if you want that.

## Keys in this repository

No real keys ship here. If you find one, report it the same way.
