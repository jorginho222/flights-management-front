# Flights Management: admin panel

Angular admin panel for the Flights Management NestJS API.

**Stack:** Angular 22, Angular Material, NgRx SignalStore, Transloco, Vitest and Docker.

## Run locally

Requires Docker. The API must be running separately (see the backend repo) on `http://localhost:3000`.

```bash
docker compose up --build
```

Open <http://localhost:4200>. Source changes reload automatically.

To point at a different API in development, change `apiUrl` in `public/config.json`.

## Commands

Run these inside the container:

```bash
docker compose exec web npm test -- --watch=false
docker compose exec web npm run lint
```

After changing dependencies, rebuild the image and refresh the `node_modules` volume:

```bash
docker compose down -v
docker compose up --build
```

## Production image

```bash
docker build --target prod -t flights-front .
docker run -e API_URL=https://api.example.com -p 8080:8080 flights-front
```

`API_URL` is written to `config.json` when the container starts, so one image works in any environment.

The API must allow this frontend's origin, or the browser blocks every request. The API only accepts origins listed in its `CORS_ORIGINS` variable, which defaults to `http://localhost:4200`. For the example above, set this in the API's `.env` and restart the API:

```bash
CORS_ORIGINS=http://localhost:4200,http://localhost:8080
``` Serve the app over HTTPS: creating an airline uses `crypto.randomUUID()`, which browsers only provide on HTTPS or localhost.

## Project layout

```text
src/app/
  core/       App-wide services: runtime config, i18n, API error handling
  layout/     Admin shell: toolbar and side menu
  shared/     Reusable UI
  features/   One folder per API resource
```

`features/airlines` is the template for new resources:

- `data/` holds the model, API service, form mapper and SignalStore.
- Each screen has its own folder, such as `airline-list/`.
- Components call the store, and only the store calls the API service.
- The store updates its state only after the API confirms.
- Provide the store on the feature's route, and move it to root only when another feature needs it.

## Adding a language

All text lives in `public/i18n/`. To add Spanish, add `es.json`, add `es` to `availableLangs` in `src/app/app.config.ts`, and add a language selector.
