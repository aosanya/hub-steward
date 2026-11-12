# Guides

Start here:

- [First day](first-day.md): install, run the API server, the console and the phone app, and pass `make test`, in order
- [Troubleshooting](troubleshooting.md): the usual causes when a step fails, and the fix

Working on a part:

- [API server](api-server.md): the Wakala API server, its layout and how to change it
- [Console](console.md): the manager's and designer's web app
- [Phone app](phone-app.md): the member's web app
- [Write an agency](write-an-agency.md): how a demo agency template is put together
- [Taskmanager tools that read the backlog](taskmanager-tools.md): pending, find, read and list, and what `taskmanager_task_find` matches
- [Reads for the Ongoing Done tab](ongoing-done-reads.md): what the API lists for finished orders and sent answers, and what is missing

How it fits and how to run it:

- [Architecture](architecture.md): the pieces and who calls whom
- [The workflow-run engine](workflow-run-engine.md): what a run start and a run step are checked against, and where the checks live
- [Load the demo agencies](load-demo-agencies.md): import a template into a running API
- [Import a demo agency](import-a-demo-agency.md): a local login and the demo agencies imported into your own database
- [Continuous integration](ci.md): the jobs that run on every push and pull request
- [Run with another model](other-models.md): add a model account
- [Languages](languages.md): fix or add a translation
- [Local database](local-database.md): Postgres and sign-in by emailed link, local for developers or a hosted Supabase project
- [Deploy locally in Docker](deploy-local.md): the database, API, console and phone app as one separate Docker environment under `deployment/local/`
