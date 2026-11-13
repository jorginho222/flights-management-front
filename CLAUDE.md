# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Angular 22 admin panel (standalone, zoneless, signals) for the NestJS API in the sibling repo `../flights-management`. That repo has its own `CLAUDE.md`, and its Swagger UI is at `http://localhost:3000/docs`.

## Commands

Development runs in Docker. The API runs separately from its own compose project, on `localhost:3000`.

```bash
docker compose up --build                 # dev server on http://localhost:4200, with hot reload
docker compose exec web npm test -- --watch=false
docker compose exec web npm run lint

# Single test file, or tests whose suite/test name matches a regex
docker compose exec web npx ng test --watch=false --include='src/app/core/http/api-error.spec.ts'
docker compose exec web npx ng test --watch=false --filter='AirlinesStore'

npx prettier --write "src/**/*.{ts,html,scss}"

# Production image (nginx on 8080); API_URL is written to config.json at container start
docker build --target prod -t flights-front .
docker run -e API_URL=http://localhost:3000 -p 8080:8080 flights-front
```

`node_modules` in the container is a named volume, separate from the host's. After changing dependencies, run `docker compose down -v && docker compose up --build`.

## Architecture

**Startup.** `provideAppInitializer` in `app.config.ts` loads `public/config.json` (the API URL) and the English translations before the app renders. Read the API URL from `AppConfigService`; it throws if read before loading finishes. There are no Angular `environment` files, so one build can target any API.

**Feature structure.** `features/airlines` is the template for new resources (airplanes, flights, passengers, orders):

- `data/` holds the model, API service, form mapper and SignalStore.
- Each screen has its own folder, such as `airline-list/`, directly under the feature. Create and edit share one component, which receives `id` as an input through `withComponentInputBinding`. Flights is the exception: its edit screen saves each part through a different endpoint, so `FlightEdit` is separate from `FlightForm`.
- Add each feature as a lazy child of `AdminLayout` in `app.routes.ts`, and add its menu entry to `menuItems` in `admin-layout.ts`.

**State flow: component → store → API service.**

- Only API services use `HttpClient`, and components never call them directly.
- The store owns server data (`withEntities`), the selected record, and loading, saving and error state. Components own form state and table paging and sorting.
- Updates are pessimistic: state changes only after the API confirms.
- `GET /airlines` returns full airlines, so `loadOne` takes the edit form's airline from the store. It only calls `GET /airlines/:id` when the store doesn't have it, such as after a page reload on the edit URL.
- Components pass `onSuccess`/`onError` callbacks into store methods for navigation and snackbars, because those are UI concerns.
- Each `rxMethod`'s flattening operator is deliberate: `switchMap` for reads, `exhaustMap` for save (blocks double submits), `concatMap` for delete.
- A store is provided on its feature route, so the list and form share one instance. That instance outlives the screens, so a form must reset its session on open (`loadOne`/`resetForm`). Move a store to root only when another feature needs it.
- A `MatDialog` component that uses a feature store must be opened with `injector: this.injector` from the opening component (see `AirlineList.openImport`). Otherwise it gets the root injector, which can't see route-provided stores.
- Flights can be searched, created and edited, but not deleted. `FlightsStore` pages on the server and keeps the last submitted filters, so reopening the screen restores the search and shows new or edited flights. It loads the airline and airplane options through `AirlinesApi` and `AirplanesApi` rather than moving those stores to root.
- The flight list shows status and schedule changes live, from the API's `GET /flights/events` Server-Sent Events stream. `FlightsApi.updates()` wraps `EventSource` and emits `connected` (with `reconnect` after a drop) and `disconnected`. It errors when the browser gives up on the stream, which turns the indicator off. `FlightList` calls `store.watchUpdates(injector)` with its own injector, so the connection closes with the screen even though the store outlives it. (`rxMethod` only honours `config.injector` for an observable input, which is why `watchUpdates` passes `api.updates()` rather than a static trigger.) The store patches a shown row only when the event's `version` is newer, which also drops the echo of the panel's own saves. It never adds or removes rows, and leaves `selected` alone so an open edit form isn't overwritten. After a reconnect it reloads the page, because missed events aren't replayed. `store.live` (`off`, `connecting`, `connected`, `reconnecting`) drives a green badge (a still dot, then "Live") above the Departure, Arrival, Punctuality and Status header names, from one `#liveBadge` template. It turns grey while reconnecting. Header cells are bottom-aligned so every column name shares a baseline. `FlightList` also flashes a departure, arrival, punctuality or status once when that value changes while shown, by comparing values between renders (`changed`, keyed `id:field`). That is view state, so it lives in the component, not the store. A flight with `wasRescheduled` gets a "Rescheduled" label under its departure and arrival, which follows live updates like the times. The Punctuality column, after Arrival, shows "On time" or "Delayed" from the API's `isDelayed`, which a job on the API sets. The panel never computes delays from the clock. A cancelled flight keeps its flag but shows nothing there. The search form's Punctuality filter sends `isDelayed`.
- `FlightForm` (`/flights/new`) and `FlightEdit` (`/flights/:id/edit`) share the form groups, validators and field components in `flights/flight-fields/`. Each time is picked with three selects (hour 1–12, minute in 5-minute steps, AM/PM) beside a date picker. `atTime` in `flight-form.mapper.ts` combines them in local time. An off-step minute stored through the API is kept as an extra option.
- `FlightEdit` has three tabs, each with its own form, endpoint and Save button: details (`PUT`), schedule and status (the two `PATCH`es). There is no `GET /flights/:id`, so `loadOne` only finds flights from the last search; after a page reload the screen asks the user to open the flight from the list. Each save merges the response into `selected` and the list row, then refills its own tab and any untouched one. Unsaved edits in other tabs are kept.
- Store saves are keyed by section (`saving`/`saveErrors` per `create`, `details`, `schedule`, `status`), so one tab saving doesn't block or clear another.
- `AirportAutocomplete` provides its own `AirportSearchStore`, so each airport field has separate suggestions. Its control holds the picked `Airport` or null, but holds the typed text while the user types, so check values with `isAirport`.
- Material labels for the paginator and datepicker go through Transloco (`TranslatedPaginatorIntl`, `TranslatedDatepickerIntl`). `provideNativeDateAdapter()` is on the flights route.
- There is deliberately no generic CRUD store. Extract shared parts only once a second resource shows what's really common. So far that is `shared/flight-classes.ts`, the validators in `shared/forms/validators.ts`, the import types and `toImportError` in `core/http/spreadsheet-import.ts`, and the `flightClasses` and `import` translation blocks.

**API format.** The API has no global prefix and no response envelope.

- The underscore keys in `luggageRules` (such as `_priceHandBaggage`) are the real wire format. Keep them confined to `airline.model.ts` and `airline-form.mapper.ts`.
- The client generates airline `id`s with `crypto.randomUUID()`, which browsers only provide on HTTPS or localhost. `AirlineForm` reuses the id when retrying a failed create.
- `POST /airlines` returns an empty body, while `POST /airplanes` returns the saved airplane. Stores ignore both and keep what they sent, so re-read data rather than expecting a body back.

**Errors.** Convert HTTP errors with `toApiError` (`core/http/api-error.ts`). It handles Nest's `message` being a string or `string[]`, and keeps messages only for 4xx. An empty `messages` array means the UI shows its generic `errors.generic` text.

**i18n.** All visible text goes through Transloco keys in `public/i18n/en.json`, including Material's built-in labels (see `TranslatedPaginatorIntl`). Spanish is planned, so don't hardcode strings.

## Testing

- Component specs use `translocoTesting()` from `core/i18n/transloco-testing.ts`, which loads the real `en.json`, so they assert on actual English text.
- Stub `AirlinesApi` at the provider level for store and component specs. Use `HttpTestingController` only in the API service spec.
- Shared test data lives in `features/airlines/testing/`.
- Vitest globals (`describe`, `vi`) are available without imports. Tests run in jsdom, so layout and real API behaviour need a browser check.
- The app is zoneless: after a state change, `await fixture.whenStable()` and call `fixture.detectChanges()` before asserting on the DOM.

## Backend status

These can go out of date, so check `../flights-management/src/airlines/airlines.controller.ts`.

- Airlines has `GET /airlines` (plain array, sorted by name), `GET /airlines/:id`, `POST /airlines`, `POST /airlines/import` and `DELETE /airlines/:id`. Unknown ids return 404, and a non-UUID id returns 400.
- There is no `PUT`. `POST /airlines` is an upsert keyed on the body's `id`, so `AirlinesApi.update` posts to it too. It returns 201 for both a create and an update.
- `DELETE /airlines/:id` returns 409 while flights still use the airline.
- Codes are unique and must be 2 letters or digits after trimming and uppercasing. A duplicate code returns 409.
- `POST /airlines/import` takes one `.xlsx` file of up to 1 MiB in the `file` field, and imports every row or none. Success returns `{ imported }`. Invalid rows return 400 with `errors: [{ row, column, messages }]`, which `toImportError` reads. Whole-file problems (missing columns, a bad workbook) return 400 with only `message`, and a file over the limit returns 413.
- Airplanes has `GET /airplanes` (sorted by brand, then model), `POST /airplanes` (upsert by `id`, returns the saved airplane), `POST /airplanes/import` and `DELETE /airplanes/:id` (409 while flights use it). There is no `GET /airplanes/:id`, so `AirplanesStore.loadOne` loads the list when the store doesn't have the airplane, and reports a missing one as 404.
- Airplane models are unique (409). `passengersCapacity` must equal the seats in `seatsConfig`, so `AirplaneForm` computes it instead of offering a field. Each class appears at most once, with 1–100 rows and 1–26 columns.
- Airplanes also have `PUT /airplanes/:id/upload-file` and `PUT /airplanes/:id/delete-file` for an image (`imageUrl`). The panel doesn't use them yet. A save leaves `imageUrl` out of the body, so the stored image is kept.
- The airplane import has `brand`, `model`, `passengersCapacity` and a `<class>Rows`/`<class>Columns` pair per class, left blank when the airplane lacks that class.
- Flights search is `QUERY /flights`, with a JSON `SearchFlightsDto` body (`origin`/`destination` IATA codes, `departureFrom`/`departureTo` ISO dates, both inclusive, `status`, `airlineCode`, `page`, `limit` ≤ 100). It needs `Content-Type: application/json`, or it returns 415. It returns `{ items, meta: { page, limit, totalItems, totalPages } }` (`core/http/paginated-result.ts`), sorted by departure. Each item includes its airline and airports.
- `POST /flights` takes a `CreateFlightDto` with a client-generated `id`, `airline`, `airplane`, `origin`, `destination`, `departure`, `arrival` and `basePrice`. It returns the saved flight, including the code the API assigns (airline code + next number). Only the airline's and airplane's ids are read, but the airports are validated as full `AirportDto`s, so send them exactly as `GET /airports` returned them. The same airport at both ends, or a departure after the arrival, returns 400.
- Search results include each flight's `airplane` and `version`. `version` goes up with every save and every order.
- `PUT /flights/:id` takes `airline`, `airplane`, `origin`, `destination`, `basePrice` and the `version` the form loaded, and returns the whole flight. It only edits `scheduled` flights (409 otherwise). With reserved seats only the price can change; with orders the route and airline can't, and a stale `version` is rejected (all 409). A new airline gives the flight a new code.
- `PATCH /flights/schedule` takes `{ id, departure, arrival }` and sets `wasRescheduled` when a time changes. It leaves the status alone, so the flight stays editable through `PUT`. The API has no `delayed`, `advanced` or `onTime` status. `PATCH /flights/status` takes `{ id, status }`. Both return the flight without `airline`, `airplane` or airports, so merge only `departure`, `arrival`, `status`, `wasRescheduled`, `isDelayed` and `version`.
- `GET /airports?search=&limit=` is a typeahead with no paging. `search` needs at least 3 characters (400 otherwise), and `limit` is at most 50. Results are ranked with an exact IATA code first, then code, name and city prefixes.
- The API only accepts browser requests from the origins in its `CORS_ORIGINS` variable, which defaults to `http://localhost:4200`.
- The API has no authentication, so neither does the panel.
- Many backend not-found cases surface as HTTP 500, not 404. Code that branches on status has to allow for this.
