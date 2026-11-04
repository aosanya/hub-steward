# Local Supabase

Configuration and migration for the local database. How to start it and point the API at it: [documentation/3. implementation/guides/local-database.md](../../documentation/3.%20implementation/guides/local-database.md).

| File | What it does |
|---|---|
| `config.toml` | Keeps Postgres, auth, the mail inbox and Studio; everything else is off. Allows the two app addresses as sign-in redirects, with email confirmation off for local use |
| `migrations/20261104000000_identity.sql` | Creates the `wakala_api` role and the functions `public.invite_member`, `public.list_sign_in_sessions`, `public.end_sign_in_session` and `public.touch_sign_in_session` |
