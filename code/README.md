# code

| Folder | What it holds |
|---|---|
| [app/](app/) | The phone app |
| [console/](console/) | The console: the designer's and manager's screens |
| [wakala-api/](wakala-api/) | The API server both apps talk to |
| [supabase/](supabase/) | Configuration and migration for the local database |

In `app/` or `console/`:

```
npm ci
npm test
npm run build
```

`npm run dev` serves either app. Each reads its server address from `public/config.json`; the default is the API on `http://localhost:8082`.
