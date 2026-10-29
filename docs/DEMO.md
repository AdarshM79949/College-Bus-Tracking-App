# Demo Script (10 minutes)

## Setup (before the demo)

1. Start MongoDB (`mongod` locally or MongoDB Atlas).
2. In one terminal:
   ```bash
   cd backend
   cp .env.example .env
   npm install
   npm run seed
   npm run dev
   ```
3. In another terminal:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
4. Open three browser windows/tabs:
   - **Admin**: http://localhost:5173 — log in as `admin@campus.edu` / `admin123`
   - **Student**: http://localhost:5173 (incognito) — log in as `student@campus.edu` / `student123`
   - **Driver**: http://localhost:5173 (another incognito or phone) — log in as `driver@campus.edu` / `driver123`

## Demo Flow

### 1. Intro (1 min)
- Show `docs/HLD.md` architecture diagram.
- Explain the three roles.

### 2. Admin creates/manages data (2 min)
- Admin dashboard -> `Routes` tab. Point out the seeded route, show edit.
- `Buses` tab: show the seeded bus mapped to a driver.
- `Drivers` tab: create a second driver live (proves admin API works).

### 3. Driver shares location (3 min)
- Switch to Driver window.
- Select bus `BUS-001`, set mode to **Simulated**, speed 30 km/h.
- Click **Start Trip**.
- Watch the map in the driver window move along the polyline.
- Toggle between Real GPS (if on phone + HTTPS) and Simulated to show both work.

### 4. Student sees live bus + ETAs (2 min)
- Switch to Student window.
- Select the route. The bus marker appears and moves in real time.
- Open a stop popup: show ETA in minutes to each upcoming stop.

### 5. Delay notification (1 min)
- In Driver window, click **Flag Delay**.
- Student window immediately shows a red toast: "Bus delayed: Driver-reported delay".
- Bus marker turns red, status badge becomes `delayed`.

### 6. Admin live monitor (1 min)
- Switch to Admin window, go to the `Monitor` tab.
- Show the live bus moving on the combined map with all routes.

### 7. Testing & CI (30 sec)
- In terminal: `cd backend && npm test` -> 41 tests pass.
- In terminal: `cd frontend && npm test -- --run` -> 10 tests pass.
- Show `.github/workflows/ci.yml` running the same tests on every push.

## Fallback Plan

- If real GPS doesn't work in the classroom -> just use Simulated mode (always works).
- If MongoDB local fails -> switch `MONGO_URI` in `.env` to a MongoDB Atlas free-tier cluster.
- If internet is down -> demo works fully locally (except OSM tiles; could pre-cache with a browser open earlier).
