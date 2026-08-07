# TripBuddy

TripBuddy is a full-stack travel planning application built as a diploma project. It lets users create trips, organize itineraries and expenses, invite other travelers, assign access roles, and review destination weather and converted costs from one responsive interface.

The application is deployed as a React frontend and a containerized microservice backend. It supports English and Serbian, light and dark themes, registered collaboration, and read-only guest access.

## Main features

- Account registration, email verification, login, password reset, profile editing, and password changes
- Validated destination search backed by Open-Meteo geocoding data
- Trip creation, editing, deletion, and participant-aware dashboards
- Three trip roles: `admin`, `user`, and `guest`
- Email invitations for existing or new users
- Reusable contacts created from accepted invitations
- Time-limited read-only guest links
- Itinerary items restricted to the trip date range
- Expense tracking with validated currencies and converted totals
- Weather forecasts and historical climate estimates for future trip dates
- English and Serbian localization
- Persistent light and dark themes
- Responsive desktop and mobile layouts
- Automated service and frontend tests in GitHub Actions

## System components

| Component | Technology | Responsibility |
| --- | --- | --- |
| Frontend | React, TypeScript, Vite | User interface, client state, localization, themes |
| Gateway | Express, TypeScript | Public backend entry point, routing, CORS, rate limits |
| Identity Service | Express, PostgreSQL | Accounts, credentials, JWTs, verification and reset flows |
| Trip Service | Express, PostgreSQL | Trips, roles, contacts, invitations, guests, itineraries, expenses |
| Integration Service | Express, Axios | Locations, weather/climate data, exchange rates |
| Identity DB | PostgreSQL 16 | Identity-owned tables |
| Trip DB | PostgreSQL 16 | Trip-domain tables |

## External services

- [Open-Meteo](https://open-meteo.com/) for destination search, forecasts, and historical climate data
- [Frankfurter](https://www.frankfurter.app/) for reference exchange rates
- [Resend](https://resend.com/) for transactional email delivery
- Vercel for the production frontend
- A Docker-enabled VPS for the production backend and databases

## Quick start

Requirements:

- Docker Desktop with Docker Compose
- Git
- Node.js 20+ and npm when running components outside Docker

1. Copy `.env.example` to `.env`.
2. Replace every `<PLACEHOLDER>` with a real local value.
3. Start the stack:

```bash
docker compose up --build
```

4. Open [http://localhost:5173](http://localhost:5173).

Local endpoints:

| Component | URL |
| --- | --- |
| Frontend | `http://localhost:5173` |
| Gateway | `http://localhost:4000` |
| Identity Service | `http://localhost:4001` |
| Trip Service | `http://localhost:4002` |
| Integration Service | `http://localhost:4003` |
| Identity PostgreSQL | `localhost:5435` |
| Trip PostgreSQL | `localhost:5436` |

Stop the stack without deleting database data:

```bash
docker compose down
```

## Repository structure

```text
TripBuddy/
├── .github/workflows/        GitHub Actions CI
├── docs/                     Project documentation
├── frontend/                 React client application
├── services/
│   ├── gateway/              Public API gateway
│   ├── identity-service/     Identity microservice
│   ├── integration-service/  External API adapter
│   └── trip-service/         Trip-domain microservice
├── docker-compose.yml        Local development stack
├── docker-compose.prod.yml   Production backend stack
├── .env.example              Local environment template
└── .env.production.example   Production environment template
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [API reference](docs/API.md)
- [Development guide](docs/DEVELOPMENT.md)
- [Deployment and operations](docs/DEPLOYMENT.md)
- [Testing guide](docs/TESTING.md)
- [User guide](docs/USER_GUIDE.md)
- [Security notes](docs/SECURITY.md)
- [Frontend guide](frontend/README.md)
- [Changelog](CHANGELOG.md)

## Testing

Each testable component owns its test command:

```bash
cd services/identity-service && npm test
cd services/trip-service && npm test
cd services/integration-service && npm test
cd frontend && npm test
```

The frontend additionally provides:

```bash
npm run lint
npm run build
```

GitHub Actions runs TypeScript checks and all four test suites on pushes to `develop` and `master`, and on pull requests targeting `develop`.

## Branch and release workflow

- `feature/*` and `fix/*` branches are created from `develop`.
- Completed branches are merged into `develop` after local verification.
- CI must be green before release.
- A tested `develop` version is merged into `master` and tagged using semantic versioning, for example `v1.3.0`.
- Production is updated from `master`.

## License and purpose

TripBuddy is an educational diploma project. The repository currently uses the package-level ISC license declarations included with its Node.js services; no separate repository-wide license file is provided.
