# Hub Steward documentation

Hub Steward is for creating agencies. An agency is a member organization of any kind: a farmers' group, a riders' collective, a computer lab, a clinical research organization, a utility. A manager or designer creates one in the console, reviews and tests it, and publishes it; members then use it on the phone app, with AI roles working beside the people. The demo holds eight synthetic agencies. Two carry most of the examples in these pages: the Siaya Farmers' Group for buying inputs together and selling the harvest, and the Siaya computer lab for access requests, member set-up and network management.

## Start here

| If you want to | Read |
|---|---|
| Understand the idea in a minute | [Why this exists](1.%20requirements/product/why-this-exists.md) |
| See who it serves and what it does | [Product](1.%20requirements/product/README.md) |
| Follow what a manager, designer or member does, step by step | [User journeys](1.%20requirements/user-journeys/README.md) |
| Run it for the first time | [First day](3.%20implementation/guides/first-day.md) |
| Fix a step that fails | [Troubleshooting](3.%20implementation/guides/troubleshooting.md) |
| Change the API server, the console or the phone app | [API server](3.%20implementation/guides/api-server.md), [console](3.%20implementation/guides/console.md), [phone app](3.%20implementation/guides/phone-app.md) |
| Write a new agency | [Write an agency](3.%20implementation/guides/write-an-agency.md) |
| Know what exists and what does not | [What exists](3.%20implementation/build/what-exists.md) |
| Know what is tested | [Testing](4.%20qa/testing/README.md) |

## The four phases

| Phase | Folder | What it holds |
|---|---|---|
| 1 | [requirements](1.%20requirements/) | [Product](1.%20requirements/product/README.md): why it exists, who it serves, what it does for an agency, what the demo covers. [User journeys](1.%20requirements/user-journeys/README.md): what each kind of user does, and the words used in the pages |
| 2 | [design](2.%20design/) | [Technical spec](2.%20design/technical-spec/README.md): how Hub Steward is built, from the overview and the agent to tools, data and privacy, deployment and hub keys. [Mockups](2.%20design/mockups/console/README.md): static design-time screens for the console and for each journey, not the shipped UI |
| 3 | [implementation](3.%20implementation/) | [Build](3.%20implementation/build/README.md): what exists and how to run it. [Guides](3.%20implementation/guides/README.md): first day, troubleshooting, the three code parts, writing an agency, architecture, loading the demo agencies, other models, languages and the local or hosted database |
| 4 | [qa](4.%20qa/) | [Testing](4.%20qa/testing/README.md): the test plan, the latest results for the console, the phone app and the API server, and what no suite covers |

Apart from the demo video below, nothing else lives at the top of this folder. A new page goes into the phase it belongs to.

## Words used here

An **agency** is the organization Hub Steward creates; the console calls it a **hub**. The **agency manager** runs it, and a **member** uses it on the **phone app**. An **AI role** is an agent the agency declares, and it acts only through tools its role may use. **Hub Steward** is the product; **the Hub Steward role** is the front-line AI agent that two of the demo agencies declare. The full list is in the [user journeys index](1.%20requirements/user-journeys/README.md).

## What is built and what is not

Pages mark each feature as Exists or To be built, and say which parts the code does not carry yet. A change to the code updates the matching page in the same pull request, as [CONTRIBUTING.md](../CONTRIBUTING.md) asks.

## Also

The demo video is not kept in git: it sits untracked and ignored at `documentation/video/`, outside the four phase folders. Build and release notes are in [CHANGELOG.md](../CHANGELOG.md). Where the project started is told in [Why this exists](1.%20requirements/product/why-this-exists.md).
