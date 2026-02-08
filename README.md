# Alien Mini App — Ride MVP (Hackathon)

Full stack starter for an Uber-like mini app with:
- Alien Mini App SDK auth + payments (using `@alien_org/react`)
- OpenStreetMap + MapLibre
- OSRM turn-by-turn routing (public demo)
- Riders + Drivers (AI or Human)
- In-app Alien Coin wallet (ledger)
- Realtime ride updates via Socket.io

## Prereqs
- Node 18+
- Postgres + Redis (Docker recommended)

## Setup

## Alien Mini App setup
- Register the Mini App in Alien console and set its **Mini App address**:
  `00000002040000000000439db38ae3fd`
- The Alien host injects the auth token at runtime; no local secret needed.

1) Frontend env
```bash
cp /Users/adnan/Documents/alien-miniapp-uber/frontend/.env.example /Users/adnan/Documents/alien-miniapp-uber/frontend/.env
```

2) Backend env
```bash
cp /Users/adnan/Documents/alien-miniapp-uber/backend/.env.example /Users/adnan/Documents/alien-miniapp-uber/backend/.env
```

3) Start DB + Redis (Docker)
```bash
docker compose -f /Users/adnan/Documents/alien-miniapp-uber/docker-compose.yml up -d
```

4) Backend
```bash
cd /Users/adnan/Documents/alien-miniapp-uber/backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

5) Frontend
```bash
cd /Users/adnan/Documents/alien-miniapp-uber/frontend
npm install
npm run dev
```

## Routing
Uses OSRM public demo by default. To point to your own OSRM server, set `VITE_OSRM_URL`.

## Notes
- Alien Mini App SDK is used via `@alien_org/react`. The host injects the auth token.
- Configure `ALIEN_RECIPIENT_ADDRESS` + `WEBHOOK_PUBLIC_KEY` in backend `.env`.
- Drivers can be marked as AI agents; they are labeled `AI` on the map.
- Wallet is a simple ledger in Postgres for hackathon speed.
