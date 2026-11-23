# Guides

Start here:

- [First day](first-day.md): install, run the API server, the console and the phone app, and pass `make test`, in order
- [Troubleshooting](troubleshooting.md): the usual causes when a step fails, and the fix

Working on a part:

- [API server](api-server.md): the Wakala API server, its layout and how to change it
- [Console](console.md): the manager's and designer's web app
- [Phone app](phone-app.md): the member's web app
- [Phone app: how `src` is organised](phone-app-structure.md): the folder strategy (features, `shared/`, `app/`) and the order of the move
- [Menu screen pattern](menu-screen-pattern.md): the page, the cards, the footer, the rows, the bottom bar and the chat that every restyled menu screen follows
- [Write an agency](write-an-agency.md): how a demo agency template is put together
- [Taskmanager tools that read the backlog](taskmanager-tools.md): pending, find, read and list, and what `taskmanager_task_find` matches
- [Who can be handed a task](who-can-hold-a-task.md): the assignee rule, the staff seat that lets a person with no login hold a task, and how she is told
- [Attribute properties](attribute-properties.md): the attribute names a person's record accepts, who may list them, and where they come from
- [Commit with commit-own-paths.sh](commit-own-paths.md): the one command agents commit with in the shared working tree, and what it refuses
- [Reads for the Ongoing Done tab](ongoing-done-reads.md): what the API lists for finished orders and sent answers, and what is missing
- [Search a live record's rows](search-live-record-rows.md): the `where` conditions of `agency_list_live_record_rows`, the operators and who sees the rows
- [Step rows](step-rows.md): where a step that adds, replaces or deletes a record's row lives in the API, the fields the app reads and the tests

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
