# TripBuddy

TripBuddy is a web application for planning and managing trips. The main focus of the project is demonstrating a microservice architecture while building a travel planning platform.

Planned features include authentication, trip management, participants, expenses, itinerary management, and external API integrations for weather and exchange rates.

## Architecture overview

TripBuddy is organized into these parts:

| Service               | Role                                                   |
| --------------------- | ------------------------------------------------------ |
| `frontend`            | React + TypeScript + Vite client application           |
| `gateway`             | API Gateway and single entry point for the frontend    |
| `identity-service`    | Authentication, users, JWT, and identity database      |
| `trip-service`        | Trips, members, expenses, itinerary, and trip database |
| `integration-service` | External APIs such as weather and exchange rates       |

Basic request flow:

- The frontend calls the gateway.
- The gateway routes requests to the backend services.
- Services communicate synchronously over HTTP REST.
- Each main service has its own PostgreSQL database.
- Docker is used for infrastructure.

## Prerequisites

- Node.js
- npm
- Docker Desktop
- Git

## Startup commands

### Start full local stack with Docker Compose

```bash
docker compose up --build
```

This starts:

- frontend: http://localhost:5173
- gateway: http://localhost:4000
- identity-service: http://localhost:4001
- trip-service: http://localhost:4002
- identity-db: localhost:5435
- trip-db: localhost:5436

The backend services wait for PostgreSQL healthchecks before starting. The frontend container also prints the app URL in the Compose logs:

```text
TripBuddy frontend available at: http://localhost:5173/
```

### Stop full local stack

```bash
docker compose down
```

### Manual local workflow

You can still run services manually if you prefer.

### Start identity PostgreSQL with Docker

```bash
docker run -d --name identity-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=identity_db -p 5435:5432 postgres:15
```

### Start trip PostgreSQL with Docker

```bash
docker run -d --name trip-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=trip_db -p 5436:5432 postgres:15
```

### Start existing identity PostgreSQL container

```bash
docker start identity-postgres
```

### Check running containers

```bash
docker ps
```

### Stop identity PostgreSQL

```bash
docker stop identity-postgres
```

### Remove identity PostgreSQL

```bash
docker rm -f identity-postgres
```

### Start identity-service

```bash
cd services/identity-service
npm install
npm run dev
```

### Start trip-service

```bash
cd services/trip-service
npm install
npm run dev
```

### Start gateway

```bash
cd services/gateway
npm install
npm run dev
```

### Start frontend

```bash
cd frontend
npm install
npm run dev
```

## Backend tests

Run backend endpoint tests from each service directory:

```bash
cd services/identity-service
npm test
```

```bash
cd services/trip-service
npm test
```

The tests use Jest + Supertest and expect the local PostgreSQL databases to be available. See `.env.test.example` in each service for the default test database settings.

## Continuous integration

GitHub Actions automatically runs the identity-service, trip-service, and frontend test suites on pushes to `develop` or `master`, and on pull requests targeting `develop`.

## Docker Compose quick reference

Start the stack:

```bash
docker compose up
```

Stop the stack:

```bash
docker compose down
```

If a service has stale dependencies, rebuild that service without cache. For example:

```bash
docker compose build --no-cache frontend
```

To reset everything, including PostgreSQL data:

```bash
docker compose down -v
docker compose up --build
```
