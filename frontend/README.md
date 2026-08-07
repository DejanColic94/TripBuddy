# TripBuddy Frontend

The TripBuddy frontend is a React 19 single-page application written in TypeScript and built with Vite.

## Responsibilities

- Authentication and account-recovery UI
- Trips dashboard and trip creation
- Trip overview, people, itinerary, and budget sections
- Registered participant and invitation flows
- Read-only guest trip view
- Destination autocomplete, weather/climate, and expense conversion
- English/Serbian localization
- Persistent light/dark themes
- Responsive desktop/mobile layout

## Requirements

- Node.js 20+
- npm
- A running TripBuddy Gateway

## Environment

Vite reads the backend URL at build/start time:

```dotenv
VITE_API_BASE_URL=http://localhost:4000
```

The local Docker Compose stack supplies this automatically. For manual frontend development, place it in an untracked frontend environment file if the default configuration is insufficient.

## Commands

```powershell
npm install
npm run dev
```

Production build:

```powershell
npm run build
npm run preview
```

Quality checks:

```powershell
npm run lint
npm test
```

## Structure

```text
src/
├── api/          Invitation and location API helpers
├── assets/       Static images
├── components/   Theme/language controls, autocomplete, weather
├── config/       API base URL
├── hooks/        Theme state and expense conversion
├── locales/      Translation resources
├── pages/        Application screens
├── test/         Vitest setup
├── types/        Domain and API types
├── App.tsx       Top-level state and route interpretation
├── i18n.ts       Localization configuration
└── main.tsx      Application bootstrap
```

## Routing

TripBuddy currently uses lightweight pathname parsing in `App.tsx`, not React Router.

Recognized deep links include:

- `/invite/:token`
- `/invites/:token/accept` (compatibility path)
- `/verify-email/:token`
- `/reset-password/:token`
- `/guest/:token`

Vercel rewrites all requests to `index.html` through `vercel.json` so the application can interpret these paths after refresh.

Only safe local redirect paths are accepted. Protocol-relative/external redirect values are rejected.

## Authentication state

The frontend stores:

- `token`: JWT
- `user`: serialized current user
- `tripbuddy-theme`: explicit `light` or `dark` preference
- `tripbuddy-language`: `en` or `sr`

When a legacy session contains a token without a cached user, the application restores the user through `/auth/me`. Invalid sessions are cleared.

## Localization

Initialization is in `src/i18n.ts`. Translation resources are strongly organized by application area in:

- `src/locales/en.ts`
- `src/locales/sr.ts`

The selected language updates the document `lang` attribute and locale-aware date/currency formatting. English is the fallback. Serbian uses Latin script and the `sr-Latn-RS` formatting locale.

To add a language, copy the English resource, preserve all keys/interpolations, register the resource/code, add a language-control option, and add tests.

## Themes

`src/hooks/useTheme.ts` resolves the initial theme in this order:

1. Saved browser preference
2. Operating-system color-scheme preference
3. Light fallback

The theme is applied to the root HTML element. Component styles use the `html[data-theme="dark"]` selector for dark overrides.

## API access

All public backend calls use the Gateway base URL from `src/config/api.ts`.

Authenticated requests attach the JWT as a Bearer token. The UI handles `401` by clearing the session and returning to authentication. Permission controls in the UI improve clarity but server-side Trip Service authorization remains authoritative.

## Tests

The frontend uses Vitest, jsdom, and Testing Library.

- `src/App.test.tsx` covers application flows and permissions.
- `src/components/WeatherForecast.test.tsx` covers weather/climate presentation.

Tests reset browser storage and URL state. Network calls are mocked; automated tests do not call production services or external providers.

When adding a screen or control, prefer accessible names and semantic elements because tests intentionally query the interface by role and label.

## Deployment

Vercel settings:

- Build command: `npm run build`
- Output directory: `dist`
- Environment: `VITE_API_BASE_URL=https://<production-api-domain>`

See [deployment documentation](../docs/DEPLOYMENT.md) for the complete release process.
