# Development Guide

## 1. Recommended workflow

The supported local workflow is Docker Compose. It starts the frontend, all four backend processes, and both PostgreSQL databases with the same service-to-service hostnames used in production.

Requirements:

- Git
- Docker Desktop with Compose v2
- Node.js 20+ and npm for direct local commands

## 2. Environment setup

Copy the local template:

```powershell
Copy-Item .env.example .env
```

Set at least these values:

```dotenv
IDENTITY_JWT_SECRET=<long-random-local-secret>
INTERNAL_SERVICE_SECRET=<different-long-random-local-secret>
RESEND_API_KEY=<resend-api-key>
EMAIL_FROM=TripBuddy <verified-sender@example.com>
FRONTEND_URL=http://localhost:5173
```

Do not commit `.env`. Values written as `<PLACEHOLDER>` are instructions to replace the value, not literal configuration.

The local Compose file already supplies database hosts, ports, names, users, and passwords to containers. Blank port entries in `.env.example` are currently informational; the Compose file defines the published local ports.

## 3. Start and stop

Build and start everything:

```powershell
docker compose up --build
```

Start in the background:

```powershell
docker compose up -d --build
```

Inspect service health:

```powershell
docker compose ps
```

Follow application logs:

```powershell
docker compose logs -f gateway identity-service trip-service integration-service frontend
```

Stop containers while preserving PostgreSQL volumes:

```powershell
docker compose down
```

## 4. Local addresses

| Component | Address |
| --- | --- |
| Frontend | `http://localhost:5173` |
| Gateway | `http://localhost:4000` |
| Identity Service | `http://localhost:4001` |
| Trip Service | `http://localhost:4002` |
| Integration Service | `http://localhost:4003` |
| Identity DB | `localhost:5435` |
| Trip DB | `localhost:5436` |

Health checks:

```powershell
Invoke-RestMethod http://localhost:4000/health
Invoke-RestMethod http://localhost:4001/health
Invoke-RestMethod http://localhost:4002/health
Invoke-RestMethod http://localhost:4003/health
```

## 5. Running components outside Docker

Docker is still recommended for PostgreSQL. To run a Node component directly, install dependencies in that component and provide environment variables that use host addresses rather than Compose service names.

Frontend:

```powershell
Set-Location frontend
npm install
npm run dev
```

Gateway:

```powershell
Set-Location services/gateway
npm install
npm run dev
```

Identity Service:

```powershell
Set-Location services/identity-service
npm install
npm run dev
```

Trip Service:

```powershell
Set-Location services/trip-service
npm install
npm run dev
```

Integration Service:

```powershell
Set-Location services/integration-service
npm install
npm run dev
```

When a service runs on the host, database hosts should be `localhost`, with Identity DB port `5435` and Trip DB port `5436`. A container must use Compose names such as `identity-db:5432`; `localhost` inside a container means that same container.

## 6. Database lifecycle

Schemas are ensured automatically when Identity and Trip services start. There is no seed script and no migration framework in this version.

### Clear records but preserve volumes

Use only in a disposable development environment:

```powershell
docker compose exec -T identity-db psql -U postgres -d identity_db -c "TRUNCATE TABLE email_verification_tokens, password_reset_tokens, users RESTART IDENTITY CASCADE;"
docker compose exec -T trip-db psql -U postgres -d trip_db -c "TRUNCATE TABLE trip_guest_access, trip_contacts, trip_invites, trip_participants, itinerary_items, expenses, trips RESTART IDENTITY CASCADE;"
```

Restart services if a manual database operation leaves application state unclear:

```powershell
docker compose restart identity-service trip-service
```

### Delete local database volumes

This is a full reset and permanently removes local database data:

```powershell
docker compose down -v
docker compose up --build
```

Do not use `-v` merely to stop the application.

## 7. Code organization

### Frontend

```text
frontend/src/
├── api/          Typed API helpers
├── components/   Reusable UI components
├── hooks/        Theme and expense-conversion hooks
├── locales/      English and Serbian resources
├── pages/        Application screens
├── types/        Shared frontend domain types
├── i18n.ts       Localization initialization
└── App.tsx       Authentication state and lightweight routing
```

### Backend services

Each service follows a compact structure:

```text
src/
├── app.ts or index.ts  Express setup
├── db/                 PostgreSQL pool and schema initialization
├── middleware/         Authentication and request guards
├── routes/             HTTP endpoints
├── services/           Email/provider logic
└── __tests__/          Jest/Supertest tests
```

## 8. Adding another frontend language

The application currently supports English and Serbian but is structured for more languages.

1. Copy `frontend/src/locales/en.ts` to a new locale file.
2. Translate values without changing object keys or interpolation names.
3. Add the language code and resource in `frontend/src/i18n.ts`.
4. Add the option to `frontend/src/components/LanguageToggle.tsx`.
5. Update `getFormattingLocale` for date and number formatting.
6. Add a switching/persistence test in `frontend/src/App.test.tsx`.

Do not translate API values such as role codes, currency codes, route paths, or request property names. Translate their displayed labels.

## 9. Branch workflow

1. Update local `develop`.
2. Create `feature/<name>` or `fix/<name>` from `develop`.
3. Keep the working change focused and run its relevant tests.
4. Push the branch and merge it into `develop`.
5. Confirm GitHub Actions is green.
6. Release tested changes by merging `develop` into `master` and creating a semantic version tag.

Never place production secrets, generated `.env` files, database dumps, or `node_modules` in Git.

## 10. Troubleshooting

### Registration or email delivery fails

- Check Identity Service logs.
- Confirm `RESEND_API_KEY`, `EMAIL_FROM`, and `FRONTEND_URL`.
- Confirm the sender is authorized in Resend.
- Check Gateway logs for proxy or rate-limit responses.

### Backend cannot connect to PostgreSQL

- Inspect `docker compose ps` and database health.
- From containers, use `identity-db:5432` or `trip-db:5432`.
- From Windows, use `localhost:5435` or `localhost:5436`.
- Confirm the database name, user, and password belong to the existing volume.

### Frontend calls the wrong backend

- In Docker development, `VITE_API_BASE_URL` is `http://localhost:4000` because the browser makes the request.
- After changing a Vite environment value, rebuild or restart the frontend.

### Deep link returns 404 in production

Confirm `frontend/vercel.json` is deployed. Its rewrite sends invitation, verification, reset, and guest URLs to the SPA entry point.

### A container still runs old code

```powershell
docker compose up -d --build <service-name>
```

Use a no-cache build only when ordinary rebuilding demonstrably retains stale dependencies:

```powershell
docker compose build --no-cache <service-name>
```
