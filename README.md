# Alien Mini App — Ride MVP

A full-stack Uber-style ride-hailing mini app built for the **Alien** platform, using the Alien Mini App SDK for auth and in-app crypto payments.

## What it does

The app runs as an embedded mini app inside the Alien host, which injects an auth token at launch (`@alien_org/react`'s `useAlien`/`useLaunchParams`). Once authenticated, a user picks a role — **Rider** or **Driver** (human or AI) — via a role-gate screen.

- **Riders** pick a pickup point (via geolocation or map tap) and a destination, see a live route drawn on an OpenStreetMap/MapLibre map using OSRM turn-by-turn routing, get a fare quote, and request a ride. Ride state (`REQUESTED → MATCHING → ASSIGNED → STARTED → COMPLETED/CANCELLED`) streams to the client in real time over Socket.io.
- **Drivers** (human or flagged `isAi`) see open ride requests, accept one, and progress it through start/complete. AI-flagged drivers are visually labeled on the map, so the demo can show autonomous "AI driver" agents alongside human ones.
- **Payments/wallet**: fares are settled in an in-app "Alien Coin" via the Alien SDK's `usePayment` hook. The backend creates a payment invoice through `@alien_org/auth-client`, associates it with the authenticated Alien user (looked up/created by `alienUserId`), and records the resulting balance/transactions in a Postgres-backed wallet ledger (`Wallet` + `Tx` models).
- A `StatusBar`/`WalletPanel` UI shows the rider's Alien Coin balance and transaction history alongside the live map and ride panel.

In short: it's a working end-to-end ride-hailing loop (request → match → drive → pay) wrapped in the Alien Mini App shell, built for a hackathon.

## Tech stack

**Frontend** (`frontend/`)
- React 18 + TypeScript, built with Vite
- `@alien_org/react` — Alien Mini App SDK (auth, launch params, payments)
- `maplibre-gl` for map rendering, OSRM public demo server for routing
- `socket.io-client` for real-time ride-status updates
- `qrcode.react` (QR code display, e.g. for payment/invoice flows)

**Backend** (`backend/`)
- NestJS (`@nestjs/common`, `@nestjs/platform-express`, `@nestjs/websockets`) on Express, TypeScript, run via `tsx`
- `@alien_org/auth-client` to verify Alien auth tokens and create payment invoices
- Prisma ORM over PostgreSQL (models: `User`, `Driver`, `Ride`, `Wallet`, `Tx`, `PaymentIntent`)
- Socket.io gateway (`RidesGateway`) broadcasting `ride:update` events to all connected clients
- Zod for request validation

**Infra**
- `docker-compose.yml` for local Postgres + Redis
- `render.yaml` (Render deployment) and `vercel.json` (frontend on Vercel)

## Project structure

```
.
├── frontend/               React + Vite mini app (runs inside the Alien host)
│   └── src/
│       ├── App.tsx             top-level state machine: auth, role selection, ride lifecycle
│       ├── api.ts               REST/socket calls to the backend
│       ├── components/
│       │   ├── RoleGate.tsx     rider/driver + human/AI persona selection
│       │   ├── RiderFlow.tsx    pickup/dropoff selection, fare quote, ride request
│       │   ├── DriverPanel.tsx  open-ride list, accept/start/complete controls
│       │   ├── OSMMapView.tsx   MapLibre map + OSRM route rendering
│       │   ├── WalletPanel.tsx  Alien Coin balance + transaction history
│       │   ├── StatusBar.tsx    live ride status display
│       │   └── Header.tsx       app chrome
│       └── types.ts
│
├── backend/                 NestJS API + WebSocket gateway
│   ├── prisma/schema.prisma     Postgres schema: User, Driver, Ride, Wallet, Tx, PaymentIntent
│   └── src/
│       ├── main.ts
│       └── modules/
│           ├── auth.controller.ts       Alien auth token verification
│           ├── rides.controller.ts      ride CRUD/state transitions (request/accept/start/complete/cancel)
│           ├── rides.gateway.ts         Socket.io gateway broadcasting ride:update
│           ├── drivers.controller.ts    driver registration, location updates, listing
│           ├── payments.controller.ts   Alien Coin invoice creation via @alien_org/auth-client
│           ├── wallet.controller.ts     wallet balance/transaction endpoints
│           └── health.controller.ts
│
├── docker-compose.yml       local Postgres + Redis for development
├── render.yaml               Render deployment config (likely backend)
└── vercel.json                Vercel deployment config (frontend)
```

## Prerequisites

- Node 18+
- Postgres + Redis (Docker recommended)

## Setup

### 1. Register the Mini App
Register the Mini App in the Alien console and set its Mini App address:
`00000002040000000000439db38ae3fd`
The Alien host injects the auth token at runtime — no local secret needed for auth itself.

### 2. Environment files
```bash
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
```
Set `ALIEN_RECIPIENT_ADDRESS` and `WEBHOOK_PUBLIC_KEY` in `backend/.env`.

### 3. Start Postgres + Redis
```bash
docker compose up -d
```

### 4. Backend
```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

### 5. Frontend
```bash
cd frontend
npm install
npm run dev
```

## Routing

Uses the OSRM public demo server by default. To point to your own OSRM instance, set `VITE_OSRM_URL` in `frontend/.env`.

## Notes

- Drivers can be flagged as AI agents (`Driver.isAi`); they're labeled `AI` on the map.
- The wallet is a simple ledger in Postgres (`Wallet`/`Tx` models) for hackathon speed — not a real on-chain settlement layer.
- Ride state changes are pushed to all connected clients via a single Socket.io `ride:update` event rather than per-user rooms.
