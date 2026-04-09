---
# This document defines the initial architecture contract for the TripBuddy system.
# It describes service responsibilities, API routes, database structure, and the main communication flows between system components.
# The purpose of this document is to serve as a technical foundation for implementation and later documentation.

# Architecture Overview

## Services Overview

### API Gateway
- Entry point for frontend
- Routes requests to services
- Validates JWT
- Adds userId to headers

### Identity Service
- User registration
- Login
- JWT generation
- Password hashing

### Trip Service
- Trips CRUD
- Trip members
- Expenses
- Itinerary

### Integration Service
- Weather API
- Exchange rate API
---

## API Gateway Routes

| Method & Path                | Service     |
| ---------------------------- | ----------- |
| POST /api/auth/register      | identity    |
| POST /api/auth/login         | identity    |
| GET /api/trips               | trip        |
| POST /api/trips              | trip        |
| GET /api/trips/:id           | trip        |
| POST /api/trips/:id/members  | trip        |
| POST /api/trips/:id/expenses | trip        |
| GET /api/weather             | integration |
| GET /api/exchange-rate       | integration |

## Identity Service Routes

| Method & Path  |
| -------------- |
| POST /register |
| POST /login    |
| GET /me        |

## Trip Service Routes

| Method & Path            |
| ------------------------ |
| GET /trips               |
| POST /trips              |
| GET /trips/:id           |
| PUT /trips/:id           |
| DELETE /trips/:id        |
| POST /trips/:id/members  |
| GET /trips/:id/members   |
| POST /trips/:id/expenses |
| GET /trips/:id/expenses  |

## Integration Service Routes

| Method & Path      |
| ------------------ |
| GET /weather       |
| GET /exchange-rate |

---

## Data Model

## Data Ownership Rule

Each service owns its own data and database schema.
There are no direct foreign key relationships between databases of different services.
Services communicate using HTTP requests and shared identifiers only.

### Identity DB: users

| Field          | Description        |
| -------------- | ------------------ |
| id (PK)        | Primary key        |
| email (unique) | User email         |
| password_hash  | Hashed password    |
| role           | admin/user         |
| created_at     | Creation timestamp |

### Trip DB

#### trips

| Field         | Description      |
| ------------- | ---------------- |
| id (PK)       | Primary key      |
| name          | Trip name        |
| destination   | Trip destination |
| start_date    | Start date       |
| end_date      | End date         |
| base_currency | Currency         |
| owner_id      | Owner (user id)  |

#### trip_members

| Field   | Description         |
| ------- | ------------------- |
| id (PK) | Primary key         |
| trip_id | Trip reference      |
| user_id | User reference      |
| role    | owner/editor/viewer |

#### expenses

| Field      | Description        |
| ---------- | ------------------ |
| id (PK)    | Primary key        |
| trip_id    | Trip reference     |
| amount     | Expense amount     |
| currency   | Currency           |
| category   | Expense category   |
| created_at | Creation timestamp |
| created_by | User who created   |

#### itinerary_items

| Field       | Description      |
| ----------- | ---------------- |
| id (PK)     | Primary key      |
| trip_id     | Trip reference   |
| title       | Item title       |
| description | Item description |
| date        | Date             |
| location    | Location         |

---

## Communication Flow

## Communication Style

Communication between services is synchronous and based on HTTP REST requests.
Asynchronous communication and message brokers will not be used in this version of the system in order to keep the architecture simpler and easier to implement, test, and document.

### Example: Get Trips

1. Frontend → Gateway
2. Gateway validates JWT
3. Gateway forwards to Trip Service
4. Trip Service filters by userId
5. Response → Gateway → Frontend

### Example: Login

1. Frontend → Gateway
2. Gateway → Identity Service
3. Identity validates credentials
4. Returns JWT
5. Gateway forwards to frontend
