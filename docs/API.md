# API Reference

## 1. Conventions

The frontend calls the Gateway. Local base URL:

```text
http://localhost:4000
```

Production uses the configured backend domain. All request and response bodies are JSON unless the successful response is `204 No Content`.

Authenticated endpoints require:

```http
Authorization: Bearer <jwt>
```

Dates use `YYYY-MM-DD`. Timestamps are returned as ISO-compatible PostgreSQL timestamp values. Error responses normally use one of these shapes:

```json
{ "message": "Identity-related error" }
```

```json
{ "error": "Trip or integration error" }
```

## 2. Gateway

### `GET /health`

Returns Gateway health without authentication.

```json
{ "service": "gateway", "status": "ok" }
```

All routes below are public Gateway paths. Direct service ports are intended for local diagnostics and Swagger only.

## 3. Identity API

### Public endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/auth/register` | Create an account and send verification email |
| `POST` | `/auth/login` | Authenticate and receive JWT/user data |
| `POST` | `/auth/verify-email` | Consume an email-verification token |
| `POST` | `/auth/resend-verification` | Request another verification email |
| `POST` | `/auth/forgot-password` | Request a password-reset email |
| `POST` | `/auth/reset-password` | Consume a reset token and set a new password |

### Authenticated endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/auth/me` | Return the current user |
| `PATCH` | `/auth/me` | Change the current user's display name |
| `PATCH` | `/auth/me/password` | Change password using the current password |
| `GET` | `/auth/users` | Return users for authenticated administrative/internal use |

### Register

```http
POST /auth/register
```

```json
{
  "name": "Ana Traveler",
  "email": "ana@example.com",
  "password": "strong-password"
}
```

Names are required and limited to 255 characters. Passwords must contain at least 8 characters and must not exceed bcrypt's 72-byte input limit. Emails are normalized to lowercase and unique case-insensitively.

### Login

```http
POST /auth/login
```

```json
{
  "email": "ana@example.com",
  "password": "strong-password"
}
```

Successful response:

```json
{
  "token": "<jwt>",
  "user": {
    "id": 7,
    "name": "Ana Traveler",
    "email": "ana@example.com",
    "role": "user",
    "emailVerified": true
  }
}
```

Unverified accounts receive `403` and must complete or resend verification.

### Verify and recover

```json
{ "token": "<one-time-token>" }
```

is used by `/auth/verify-email`.

```json
{ "email": "ana@example.com" }
```

is used by `/auth/resend-verification` and `/auth/forgot-password`.

```json
{
  "token": "<one-time-token>",
  "newPassword": "new-strong-password"
}
```

is used by `/auth/reset-password`.

Forgot-password responses are intentionally non-enumerating: the client receives the same general result whether the account exists or not.

### Update profile

```http
PATCH /auth/me
Authorization: Bearer <jwt>
```

```json
{ "name": "Updated Name" }
```

The response contains a refreshed JWT and user projection.

### Change password

```json
{
  "currentPassword": "old-password",
  "newPassword": "new-strong-password"
}
```

## 4. Trip API

### Public invitation and guest endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/trips/invites/:token` | Preview an invitation |
| `POST` | `/trips/invites/:token/accept` | Accept using a session or create an invited account |
| `POST` | `/trips/invites/:token/guest` | Exchange an invite for guest access |
| `GET` | `/trips/guests/:token/trip` | Read the guest projection of a trip |

Invitation preview returns the trip name, inviter name, invited email, assigned role, expiry, and whether an account already exists.

Accepting while authenticated requires the JWT email to match the invited email. Accepting without authentication requires `name` and `password`; the Identity Service creates the invited account.

Guest request:

```json
{ "displayName": "Guest Traveler" }
```

The response includes a raw guest token once. The database stores only its SHA-256 hash. Guest access expires after 30 days unless revoked earlier.

### Authenticated trip endpoints

| Method | Path | Required permission | Purpose |
| --- | --- | --- | --- |
| `GET` | `/trips` | Authenticated | List owned and shared trips |
| `POST` | `/trips` | Authenticated | Create a trip |
| `GET` | `/trips/:id` | View | Get trip details |
| `PUT` | `/trips/:id` | Manage | Update trip metadata |
| `DELETE` | `/trips/:id` | Manage | Delete trip and related records |
| `GET` | `/trips/:id/participants` | View | List participants with names |
| `POST` | `/trips/:id/participants` | Manage | Add a previous contact |
| `PATCH` | `/trips/:id/participants/:userId` | Manage | Change participant role |
| `DELETE` | `/trips/:id/participants/:userId` | Manage | Remove participant |
| `GET` | `/trips/:id/contacts` | Manage | Search reusable contacts |
| `GET` | `/trips/:id/invites` | Manage | List invitations |
| `POST` | `/trips/:id/invites` | Manage | Create and email an invitation |
| `DELETE` | `/trips/:tripId/guests/:guestId` | Manage | Revoke guest access |
| `GET` | `/trips/:tripId/summary` | View | Return duration and item counts |
| `GET` | `/trips/:tripId/itinerary` | View | List itinerary items |
| `POST` | `/trips/:tripId/itinerary` | Contribute | Add itinerary item |
| `DELETE` | `/trips/:tripId/itinerary/:itemId` | Manage | Delete itinerary item |
| `GET` | `/trips/:tripId/expenses` | View | List expenses |
| `POST` | `/trips/:tripId/expenses` | Contribute | Add expense |
| `DELETE` | `/trips/:tripId/expenses/:expenseId` | Manage | Delete expense |

### Create or update a trip

```json
{
  "name": "Lisbon Spring",
  "description": "Long weekend by the coast",
  "destination": "Lisbon, Portugal",
  "destinationId": 2267057,
  "destinationLatitude": 38.71667,
  "destinationLongitude": -9.13333,
  "destinationTimezone": "Europe/Lisbon",
  "destinationCountryCode": "PT",
  "startDate": "2026-09-10",
  "endDate": "2026-09-14"
}
```

Important rules:

- Name, validated destination metadata, and both dates are required.
- End date cannot precede start date.
- A creator cannot have two trips with the same name, case-insensitively.
- The creator receives effective `admin` permission.

### Participants and roles

```json
{ "userId": 12, "role": "user" }
```

is used to add a participant. The user must be available through the current user's previous accepted-invitation contacts.

```json
{ "role": "guest" }
```

is used to update a participant role. Supported roles are `admin`, `user`, and `guest`.

### Create invitation

```json
{
  "email": "friend@example.com",
  "role": "user"
}
```

The invite expires after seven days. Successful creation also triggers email delivery; an email-delivery failure causes the operation to fail rather than pretending the invitation was sent.

### Itinerary item

```json
{
  "title": "Museum reservation",
  "description": "Arrive 15 minutes early",
  "scheduledDate": "2026-09-11"
}
```

The scheduled date, when present, must fall inside the trip's date range.

### Expense

```json
{
  "title": "Hotel",
  "amount": 420.50,
  "currency": "EUR",
  "category": "Accommodation"
}
```

Supported currencies: `EUR`, `USD`, `GBP`, `CHF`, `RSD`, `CAD`, `AUD`, and `JPY`.

## 5. Integration API

### Location search

```http
GET /integrations/locations?query=Belgrade
```

The query must contain 2–100 characters. The response contains normalized provider results and attribution.

### Weather and climate

```http
GET /integrations/weather?destination=Belgrade%2C%20Serbia&startDate=2026-09-10&endDate=2026-09-14
```

The result reports `available`, normalized location details, per-day conditions, source (`forecast` or `climate`), and provider attribution. Trips may receive a mixed response when only part of the date range is covered by the live forecast.

### Exchange rate

```http
GET /integrations/exchange-rate?from=USD&to=EUR&amount=100
```

Currency codes must contain three uppercase letters after normalization. Amount must be greater than zero and no greater than `1,000,000,000`.

## 6. Service-only endpoints

The Identity Service exposes `/internal/users/by-ids`, `/internal/users/by-email`, and `/internal/users/invited` for the Trip Service. These require `INTERNAL_SERVICE_SECRET` and are not routed through the public Gateway.

Direct Swagger interfaces are available locally at:

- `http://localhost:4001/api-docs`
- `http://localhost:4002/api-docs`

The source code remains authoritative when Swagger annotations and implemented routes differ.

## 7. Common status codes

| Code | Meaning in TripBuddy |
| --- | --- |
| `200` | Successful read/update/action |
| `201` | Resource or guest access created |
| `204` | Successful deletion with no body |
| `400` | Invalid request or validation failure |
| `401` | Missing/invalid login or invited account must log in |
| `403` | Authenticated but insufficient permission/wrong invited account |
| `404` | Resource hidden or not found |
| `409` | Unique conflict or already-used invitation |
| `410` | Invitation expired |
| `429` | Gateway rate limit exceeded |
| `502` | Required internal/provider service unavailable |
| `500` | Unexpected server failure |
