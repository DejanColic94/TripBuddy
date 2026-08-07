# Testing Guide

## 1. Test strategy

TripBuddy uses automated tests at service and frontend boundaries, followed by manual end-to-end QA in the deployed application.

| Component | Tools | Main coverage |
| --- | --- | --- |
| Identity Service | Jest, Supertest, PostgreSQL | Registration, login, profile, passwords, verification, recovery, internal API |
| Trip Service | Jest, Supertest, PostgreSQL | Trips, roles, authorization, participants, contacts, invitations, guests, itinerary, expenses |
| Integration Service | Jest, Supertest, mocked providers | Locations, weather/climate, exchange rates, provider errors |
| Frontend | Vitest, Testing Library, jsdom | Authentication flows, trip UI, permissions, invitations, guests, themes, localization, weather rendering |

The Gateway currently receives TypeScript/build validation and production smoke coverage through the complete system; it does not have a standalone Jest suite.

## 2. Identity Service

Tests require a PostgreSQL database matching the test environment configuration.

```powershell
Set-Location services/identity-service
npm ci
npx tsc --noEmit
npm test
```

Configuration template: `services/identity-service/.env.test.example`.

Test areas:

- Authentication and validation
- Case-insensitive email uniqueness
- JWT-protected profile endpoints
- Password changes
- Email verification token lifecycle
- Password recovery token lifecycle
- Transactional email service behavior
- Internal shared-secret middleware
- Internal lookup and invited-account routes

## 3. Trip Service

```powershell
Set-Location services/trip-service
npm ci
npx tsc --noEmit
npm test
```

Configuration template: `services/trip-service/.env.test.example`.

Test areas:

- Trip creation, validation, listing, update, and deletion
- Owned and shared trip visibility
- `admin`, `user`, and `guest` permissions
- Participant and role management
- Contact creation from accepted invitations
- Invitation preview, acceptance, expiry, and guest access
- Identity Service client behavior
- Invitation email delivery behavior
- Trip summary calculations
- Expense validation and CRUD
- Itinerary date-range validation and CRUD

The Trip Service suite uses `--runInBand` because tests share a database and rely on deterministic cleanup/order.

## 4. Integration Service

```powershell
Set-Location services/integration-service
npm ci
npx tsc --noEmit
npm test
```

Test areas:

- Location query validation and normalized results
- Forecast responses
- Historical climate estimates
- Mixed forecast/climate ranges
- Currency conversion validation and normalized responses
- Provider timeout/error translation

External providers should be mocked in automated tests. CI reliability must not depend on live third-party availability.

## 5. Frontend

```powershell
Set-Location frontend
npm ci
npm run lint
npm run build
npm test
```

Frontend tests mock `fetch` and exercise the rendered application as a user would. Prefer role/label queries over CSS selectors so tests also validate accessibility semantics.

When adding visible features:

- Test the permitted role and at least one denied/read-only role.
- Test loading, empty, success, and failure states where relevant.
- Keep English behavior stable.
- Add Serbian assertions for new shared localization behavior.
- Test persisted browser preferences when adding theme/language settings.

## 6. Run all suites

There is no root test aggregator. Run the suites from their component directories:

```powershell
Push-Location services/identity-service; npm test; Pop-Location
Push-Location services/trip-service; npm test; Pop-Location
Push-Location services/integration-service; npm test; Pop-Location
Push-Location frontend; npm test; Pop-Location
```

Run commands separately when diagnosing a failure so the first failed component remains obvious.

## 7. Continuous integration

Workflow: `.github/workflows/ci.yml`.

Triggers:

- Push to `develop`
- Push to `master`
- Pull request targeting `develop`

CI contains four independent jobs:

1. Identity Service: PostgreSQL 16 service, `npm ci`, TypeScript check, Jest
2. Trip Service: PostgreSQL 16 service, `npm ci`, TypeScript check, Jest
3. Integration Service: `npm ci`, TypeScript check, Jest
4. Frontend: `npm ci`, TypeScript build, Vitest

Node.js 20 is used in CI. Dependency installation uses lockfiles and `npm ci` for repeatability.

A green workflow means automated checks passed; it does not replace manual browser, email, provider, deployment, or mobile testing.

## 8. Manual release QA

Use fresh disposable accounts and at least two browsers/private windows.

### Identity

- Register with valid and invalid input.
- Confirm duplicate email handling.
- Verify email from the delivered link.
- Resend verification.
- Log in/out and restore a session after refresh.
- Request and complete password reset.
- Edit profile name and change password.

### Trip administration

- Search/select a destination and create a valid trip.
- Confirm required-field and date-order validation.
- Confirm duplicate trip-name handling.
- Edit trip metadata and delete a disposable trip.
- Confirm creator name, destination, dates, weather, and summary.

### Collaboration

- Send invitations for all three roles.
- Accept as an existing account.
- Accept while creating a new account.
- Continue through read-only guest access.
- Add a previous contact to another trip.
- Change a participant's role and remove them.
- Confirm invite expiry/already-accepted/wrong-account messages.

### Permissions

- Admin: full management and deletion controls.
- User: view and contribute, without trip/participant/invite management.
- Registered guest: same trip presentation in read-only form.
- Guest link: read-only projection with no mutation controls.

### Itinerary and expenses

- Add an itinerary item inside the trip date range.
- Confirm outside-range dates are blocked.
- Delete an itinerary item as admin.
- Add expenses in several supported currencies.
- Confirm converted and original totals.
- Delete an expense as admin.

### Integrations and presentation

- Test a near-term forecast.
- Test a far-future climate estimate.
- Test a range containing both sources.
- Switch between English and Serbian.
- Switch light/dark mode and refresh.
- Repeat primary flows at desktop and mobile widths.
- Refresh deep invitation, guest, verification, and reset links.

## 9. Failure diagnosis

### CI only

- Compare CI Node/PostgreSQL versions with local versions.
- Use `npm ci`, not an old `node_modules` directory.
- Read the first assertion/database error, not only the final exit code.
- Check whether a changed response legitimately requires a test update.

### Database tests

- Confirm the test database is reachable.
- Confirm environment variables select a test database, never production.
- Inspect leftover records and sequence state.
- Run the failing suite serially.

### Frontend tests

- Reset `localStorage`, URL state, language, and theme between tests.
- Await asynchronous UI changes with `findBy*` or `waitFor`.
- Avoid assertions that depend on unstable provider dates or local time zones.
- Update English expectations only when wording intentionally changed.
