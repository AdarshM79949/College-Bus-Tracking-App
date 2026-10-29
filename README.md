# Campus Bus Tracking System

A full-stack **real-time campus bus tracking** application. Students see **live bus positions** and **per-stop ETAs** on a map, **drivers** stream **GPS or simulated** movement along a route and can **flag delays**, and **admins** manage **routes, buses, and users** and use a **live monitor** of all active buses. The stack is **MERN** (MongoDB, Express, React, Node) with **Socket.IO** for bidirectional live updates and **JWT**-based auth for both HTTP and WebSocket connections.

---

## What is implemented

### Students

- **Role-based access** after login; dedicated **student** view.
- **Live map** (Leaflet + OpenStreetMap tiles) with the bus as a **moving marker** for the selected route.
- **Subscribe to a route** via Socket.IO; receive **`bus:location`** updates with **ETAs** to upcoming stops (server-side calculation using distance and configurable average speed).
- **Delay awareness**: **`bus:delay`** events and toasts when the bus is delayed (driver-reported or server-detected from stale location while active).
- **Route selection** to focus on one campus loop and its stops.

### Drivers

- **Mobile-friendly** driver dashboard in the browser.
- **Start / end trip** for an assigned bus; server creates/updates **Trip** records and bus **status**.
- **Location updates** over Socket.IO: **`location:update`** with latitude/longitude and optional speed.
- **Real GPS** using the browser Geolocation API, or **simulated movement** along the route **polyline** (reliable for labs and when GPS is unavailable).
- **Flag delay** with **`status:delay`**; subscribers see a delay notification and the bus can show a **delayed** state.

### Admins

- **CRUD** for **routes** (stops with order, names, lat/lng, and a **polyline** for path visualization and simulation).
- **CRUD** for **buses** (link to route and optional driver) and for **user accounts** (e.g. create drivers) where supported by the API.
- **List and monitor**: **Monitor** view with a **live map of all active buses**; can use **`subscribe:all`** for fleet-wide socket updates.
- **Trip history** (read-only) via trips API for operational review where implemented.

### Backend (API and real-time)

- **REST API** (Express): **register / login / me**; **routes, buses, users, trips** with **role-gated** writes (e.g. admin for mutations).
- **Socket.IO** server (same Node process as HTTP):
  - Client **handshake auth** with JWT in **`auth.token`**.
  - **Rooms** such as `route:<routeId>` and `admin:all` for targeted broadcasts.
  - Events including **`subscribe:route`**, **`subscribe:all`** (admin), **`trip:start`**, **`trip:end`**, **`location:update`**, **`status:delay`**.
  - Server emits **`bus:location`** (with ETAs), **`bus:delay`**, **`bus:status`**, **`error`**.
- **MongoDB** (Mongoose) models: **User**, **Route**, **Bus**, **Trip** with location history and relationships as in [docs/HLD.md](docs/HLD.md).
- **ETAs** via **`avgBusSpeedKmh`** (default 25, env **`AVG_BUS_SPEED_KMH`**); **delay heuristics** (e.g. no update for **30s** while active) in socket handlers.
- **Empty database**: optional **auto-seed** of demo users/route/bus on first start (see server behavior); you can also run **`npm run seed`** explicitly.
- **Resilience**: can fall back to in-memory MongoDB in dev if configured (see `backend` server and tests).

### Frontend (SPA)

- **Vite** + **React 18** + **React Router** with **protected routes** by role (`ProtectedRoute`, `AuthContext`).
- **Tailwind CSS** for UI, **react-hot-toast** for notifications.
- **Socket.IO client** with token from auth; shared hooks (e.g. `useSocket`) and map components.
- **Production build**: `npm run build` for static assets.

### Quality: tests and CI

- **Backend**: **Jest** — unit tests (e.g. auth, models, **ETA calculator**, **route simulator**) and **integration** tests (**Supertest** for HTTP, **socket.io-client** + in-memory server for real-time). Optional **`npm run test:coverage`** in `backend` for a coverage summary.
- **Frontend**: **Vitest** + **@testing-library/react** — e.g. **Login**, **API** helpers, **ProtectedRoute** behavior.
- **GitHub Actions** (`.github/workflows/ci.yml`): on push/PR to **main** or **master**, runs `npm test` in **backend** and `npm test -- --run` in **frontend** on Node 20.

### Documentation and design

- **[docs/HLD.md](docs/HLD.md)** — high-level design: problem, context, architecture, ERD, sequence, security, NFR, testing, stack.
- **Diagram images** (draw.io exports) in the **repository root** (e.g. `system context.drawio.png`, `hld.drawio.png`, `logical_layers.drawio.png`, `erDiagram.drawio.png`, `sequence.drawio.png`) and embedded in the HLD where applicable.
- **[docs/API.md](docs/API.md)** — REST and Socket event contracts.
- **[docs/DEMO.md](docs/DEMO.md)** — 10-minute classroom demo script (multi-window, simulated GPS, delay).
- **[docs/PRESENTATION_GAMMA.md](docs/PRESENTATION_GAMMA.md)** — slide prompts and a four-person presentation script (feature owners).

---

## Technology stack

| Layer | Technology |
| ----- | ---------- |
| Runtime | Node.js 20+ |
| API & real-time | Express 4, Socket.IO 4, `cors`, `dotenv` |
| Data | MongoDB 6+, Mongoose 8 |
| Auth | `jsonwebtoken` (HS256), `bcryptjs` for passwords |
| Web UI | React 18, Vite, React Router 6, Tailwind CSS |
| Maps | Leaflet, OpenStreetMap tiles (no key required) |
| Toasts | react-hot-toast |
| Backend tests | Jest, Supertest, `mongodb-memory-server` |
| Frontend tests | Vitest, jsdom, React Testing Library |
| CI | GitHub Actions (`npm ci` + test) |

---

## Repository structure

```
.
├── backend/                 # Express app, Socket.IO, Mongoose, Jest
│   ├── src/
│   │   ├── server.js        # HTTP + Socket.IO bootstrap, DB connect, optional auto-seed
│   │   ├── app.js           # Express app and routes
│   │   ├── config.js
│   │   ├── models/         # User, Route, Bus, Trip
│   │   ├── middleware/     # JWT
│   │   ├── routes/         # API route modules
│   │   ├── sockets/        # Socket.IO handlers
│   │   ├── utils/          # e.g. ETA calculation
│   │   └── scripts/        # seed
│   └── tests/              # unit + integration
├── frontend/                # Vite + React, Vitest
│   ├── src/
│   │   ├── pages/          # Home, Login, student, driver, admin
│   │   ├── components/     # Navbar, map, protected route
│   │   ├── context/        # Auth
│   │   ├── hooks/
│   │   └── test/
├── docs/                    # HLD, API, demo, presentation copy
├── .github/workflows/       # ci.yml
├── system context.drawio.png   # HLD figure (root; optional)
├── hld.drawio.png
├── ... (other *.drawio.png)
└── README.md
```

---

## Prerequisites

- **Node.js** 20+
- **MongoDB** locally (e.g. `mongodb://127.0.0.1:27017`) or **MongoDB Atlas** connection string
- (Optional) **Git** and **GitHub** for CI

---

## Configuration (backend)

Copy `backend/.env.example` to `backend/.env` and adjust:

| Variable | Purpose |
| -------- | ------- |
| `PORT` | API port (default `4000`) |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret for signing JWTs (set a strong value in production) |
| `JWT_EXPIRES` | Token lifetime (default `7d`) |
| `CLIENT_ORIGIN` | Allowed CORS origin (e.g. Vite `http://localhost:5173`) |
| `AVG_BUS_SPEED_KMH` | Used for ETA calculation (default `25`) |

---

## Quick start

### 1. Clone and install

```bash
# Backend
cd backend
cp .env.example .env
# Edit .env if you use Atlas or a non-default port

npm install
```

```bash
# Frontend (separate terminal)
cd frontend
npm install
```

### 2. Seed and run (typical)

```bash
# Terminal 1 — backend
cd backend
npm run seed    # optional if DB is empty; creates demo users, route, bus
npm run dev     # http://localhost:4000
```

```bash
# Terminal 2 — frontend
cd frontend
npm run dev     # http://localhost:5173
```

On **Windows PowerShell**, if `cd backend && npm run dev` fails, use separate lines or `;` instead of `&&`.

### 3. Demo logins (after `npm run seed` in `backend`)

| Role    | Email              | Password   |
| ------- | ------------------ | ---------- |
| Admin   | admin@campus.edu   | admin123   |
| Driver  | driver@campus.edu | driver123  |
| Student | student@campus.edu | student123 |

For a guided walkthrough (three browsers: admin, student, driver), see **[docs/DEMO.md](docs/DEMO.md)**.

---

## Testing (local)

```bash
cd backend
npm test
# optional: npm run test:coverage
```

```bash
cd frontend
npm test -- --run
```

As of the latest documented run: **~41** backend and **~10** frontend tests (see [docs/DEMO.md](docs/DEMO.md) for the exact check during your demo).

---

## CI (GitHub)

Workflow: **[.github/workflows/ci.yml](.github/workflows/ci.yml)** — install with `npm ci` and run the test scripts in `backend` and `frontend` on **push/PR** to `main` or `master`.

---

## Production build (reference)

```bash
cd frontend
npm run build        # output in frontend/dist
cd ../backend
# Set NODE_ENV, MONGO_URI, JWT_SECRET, CLIENT_ORIGIN; run npm start
```

For Socket.IO with **multiple** Node processes, use a **sticky session** load balancer. Serve the Vite `dist` from static hosting; point the app at the API/WebSocket base URL (see [docs/HLD.md](docs/HLD.md) deployment section).

---

## Documentation index

| File | Content |
| ---- | ------- |
| [docs/HLD.md](docs/HLD.md) | High-level design and diagrams (plus root PNGs) |
| [docs/API.md](docs/API.md) | REST + Socket contracts |
| [docs/DEMO.md](docs/DEMO.md) | Live demo script and test commands |

---

## License

This project is maintained for **Software Engineering Lab** coursework.