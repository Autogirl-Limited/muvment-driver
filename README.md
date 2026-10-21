# Muvment Driver PWA

Phone-only Progressive Web App for Muvment professional drivers. It is a port of the
Expo/React Native driver app (`../muvment-driver-apk`) to **Next.js 15 (App Router)**,
with **TanStack Query** for data, **NextAuth (Auth.js v5)** for sessions, **Serwist** for
the service worker and an Apple Human Interface Guidelines inspired UI in light and dark mode.

## Run

```bash
npm install
cp .env.example .env.local   # then fill AUTH_SECRET (openssl rand -base64 32)
npm run dev                  # http://localhost:3000
```

`npm run build && npm start` produces the installable PWA (manifest + `public/sw.js`).
The service worker is only generated for production builds.

Open the URL on a phone (or use the browser's device toolbar). Desktop browsers get a
hand-off screen with a QR code; set `NEXT_PUBLIC_ALLOW_DESKTOP=true` to bypass it while
developing.

### Mock backend

To click through every screen without real credentials, point the app at the built-in
mock API (dev only; any email/password signs in):

```
NEXT_PUBLIC_API_URL=http://localhost:3000/api/mock
```

## Architecture

| Area | Where |
| --- | --- |
| Routes (screens) | `src/app` — `(auth)` public, `(app)` protected, `(app)/(tabs)` with the tab bar |
| Auth | `src/auth.ts` (Credentials provider → backend `/auth/login`, refresh in the JWT callback), `src/middleware.ts` (route guard) |
| API client + hooks | `src/lib/api` — fetch client with bearer token, 401 → NextAuth refresh → retry |
| Domain utils | `src/lib/utils` (trip formatting, checklist navigation, photo prep/upload, storage) |
| Live location sharing | `src/lib/tracking` (foreground `watchPosition`, batched upload) |
| UI kit | `src/components/ui` (Button, TextField, OTPInput, Sheet/AlertDialog, Toggle, ListRow…) |
| Theme | `src/app/globals.css` tokens + `src/providers/ThemeProvider.tsx` (System / Light / Dark) |
| PWA | `src/app/manifest.ts`, `src/app/sw.ts`, `public/icons` |

### Web vs native differences

- **Camera**: `<input type="file" capture>` opens the device camera; photos are downscaled
  on a canvas before the presigned S3 upload.
- **Location**: browsers only deliver GPS while the tab is open, so live sharing runs in
  foreground mode and the navigation screen asks the driver to keep the screen on.
- **Maps**: Leaflet + OpenStreetMap tiles (no key). Set `NEXT_PUBLIC_GOOGLE_ROUTES_API_KEY`
  for traffic-aware routes; otherwise a straight-line estimate is drawn and "Open in
  Google Maps" hands off turn-by-turn navigation.
- **Push notifications**: the backend preference toggle is kept; live alerts arrive over
  the STOMP/SockJS socket while the app is open.
- **Secure storage**: tokens live in the encrypted NextAuth cookie; only UI preferences
  and idempotency keys use `localStorage`.
