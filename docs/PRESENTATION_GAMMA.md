# Campus Bus Tracker — Gamma / slide copy and speaker script

Use this with [Gamma](https://gamma.app) (or any deck tool): copy the **Gamma instructions** per slide into the prompt, then add visuals (maps, code snippets, logos).  
**Rehearsal:** follow [DEMO.md](DEMO.md) for the live demo order.

**Rule:** All four team members own **one feature** each (auth, admin, driver, student) with **implementation** + **live demo**. No one is assigned “only title” or “only Q&A” — title/problem are short and shared; Q&A draws on what each person already presented.

---

## 10 slides — Gamma instructions and talking points

Target **10 physical slides**. If your template is strict, **merge** rows 3A–3D into one slide (four equal columns) or into two slides (two features per slide).

| # | Slide title | Gamma instruction (paste as deck prompt) | Notes for speakers |
|---|-------------|------------------------------------------|-------------------|
| 1 | Title | Create a clean title slide: “Campus Bus Tracking System,” subtitle: Software Engineering Lab / MERN real-time app. **Layout: four equal blocks** — each block has **one team member’s name** and their **one-line feature** (e.g. “Name — Auth & security,” “Name — Admin & monitor,” “Name — Driver & live stream,” “Name — Student & ETAs”). Add optional React/Node/Leaflet icons. | Each person: **one sentence** — who you are and which feature you built. |
| 2 | Problem and goals | Modern campus with **unreliable bus visibility**: students wait too long or miss connections. **Goals (bullets):** live bus position on a map, **per-stop ETAs**, **instant delay alerts** (driver flag or auto-detect), **admin** tools for routes/buses/drivers and a **fleet monitor**. Aspirational: drivers use a **phone browser** only. Style: problem statement + 4 short outcome bullets, minimal text. | Split 2–3 bullets across 2 people max, **under 1 minute total**. |
| 3A | Feature — Authentication & roles | **Owner 1** slide. Columns: (1) **User value** — sign up, sign in, get JWT; only see screens for your **role** (student / driver / admin). (2) **Stack** — Express auth routes, bcrypt, JWT; React `AuthContext` + `ProtectedRoute`. (3) **One code hint** — `Authorization: Bearer` and socket `auth.token`. (4) **Tests** — `backend` auth API + `frontend` Login and `ProtectedRoute` tests. | Owner 1 **drives** login/register and **three role logins** in the demo. |
| 3B | Feature — Admin & monitor | **Owner 2** slide. CRUD for **routes** (stops + polyline), **buses**, **drivers**; list buses with locations; **Monitor** — live map of all active buses. REST only for writes; mention `GET` for lists. **Files to hint:** `backend/src` routes, `frontend/src/pages/admin` (`Routes`, `Buses`, `Drivers`, `Monitor`). **Tests:** `backend/tests/integration/api.test.js`. | Owner 2 **drives** Admin: tabs + **Monitor** while others prep driver/student. |
| 3C | Feature — Driver & real-time | **Owner 3** slide. **Trip:** start / end. **Location:** `location:update` every few seconds. **Simulated** mode along route polyline for lab demos. **Flag delay** → `status:delay` → all subscribers notified. **Files:** `backend/src/sockets/index.js`, `frontend/.../driver/DriverDashboard.jsx`. **Tests:** `tests/integration/sockets.test.js`, `routeSimulator` unit. | Owner 3 **drives** Driver: select bus, **Simulated**, **Start trip**, then **Flag delay**. |
| 3D | Feature — Student, map & ETAs | **Owner 4** slide. **Subscribe** to a route; **map** with moving bus; **per-stop** ETA from server payload; **delay** toast and visual state. **Files:** `StudentView`, `useSocket`, `MapComponent`, server `etaCalculator` + `bus:location` payload. **Tests:** ETA unit + socket integration. | Owner 4 **drives** Student window: same route as driver, popups, delay UX when Owner 3 flags. |
| 4 | High-level architecture | **Single Node** process: **Express** (REST) + **Socket.IO** (rooms). **MongoDB** (Mongoose). **Room** per route: `route:<id>` to limit broadcasts. **Diagram** suggestion: 3 clients (Student / Driver / Admin) to one server to DB; separate arrows for HTTP vs WebSocket. | One spokesperson **60s**; ties all four features. |
| 5 | Real-time sequence (E2E) | **Sequence in 5 steps:** (1) Student `subscribe:route` → join room. (2) Driver `trip:start` → bus active, trip row. (3) Loop: `location:update` → DB + `bus:location` { **etas** }. (4) Optional: `status:delay` or gap → `bus:delay`. (5) `trip:end`. **Visual:** left-to-right swimlane or numbered vertical list. | Owner 3 or 4 can narrate; point at [HLD.md](HLD.md) sequence diagram. |
| 6 | Technology stack | **Two columns.** Left **frontend:** Vite, React, Tailwind, React Router, Leaflet, `socket.io-client`, react-hot-toast. **Right** **backend:** Node, Express, Socket.IO, Mongoose, JWT, bcrypt. **Data:** MongoDB. **One line** why: one language, fast iteration, free maps, rooms for scaling. | 45s; can be any member. |
| 7 | Design before code (HLD) | We prepared **HLD** before implementation: ERD, architecture flow, **driver–student** sequence, security. **Point to** `docs/HLD.md` and `docs/HLD-FIGURES.md`. Screenshot or embed **mermaid** export. **Optional footnote:** each of four owners maps to a box (auth → REST, driver/student → sequence). | Each owner: **one line** linking **their** feature to a figure. |
| 8 | Testing | **Table:** **Backend** — Jest: unit (ETA, route simulator, models, auth) + integration (Supertest for REST, `socket.io-client` for sockets). **Current count:** 41 tests. **Frontend** — Vitest, Testing Library, Login, `api`, and `ProtectedRoute` tests. **Current count:** 10 tests. **Command lines** for slide footer: `cd backend && npm test` and `cd frontend && npm test -- --run` (on Windows use `;` instead of `&&` in PowerShell). **CI:** `.github/workflows/ci.yml` runs the same on push/PR to `main` or `master`. Optional: `cd backend && npm run test:coverage` for a summary. | **Split:** Owner 1 auth tests, Owner 2 admin API, Owners 3–4 sockets + ETA. **Optional live:** 10s terminal. |
| 9 | Live demo (handoffs) | **Numbered 1–4** matching feature owners: (1) **Auth** — log in. (2) **Admin** — show data + **Monitor**. (3) **Driver** — start trip, simulated path, **delay**. (4) **Student** — see bus, ETAs, **delay** alert. Small reminder: 3 browser windows, **DEMO.md** for detail. | Strict **handoff** order: each person speaks **only** during their number. |
| 10 | Q&A | Thank the audience; **repo / docs** path if allowed; “Questions — any of us can answer, **feature depth** to the person who built that part.” | All four stand ready; direct deep questions to the right owner. |

---

## Long paragraphs for Gamma (five “content block” pastes)

Use when Gamma asks for a **single long** content block (or split across slides 2, 4, 5, 6, 7).

**Block 1 — Problem and goals**  
On many campuses, students do not have reliable, real-time information about where buses are or when they will reach the next stop. This leads to long unnecessary waits, missed connections, and frustration. The Campus Bus Tracking system addresses that gap by providing a **live map** of each bus, **per-stop estimated arrival times** that update as the bus moves, and **delay notifications** when a driver flags a problem or when updates stop. Administrators need a single place to **manage routes, buses, and driver accounts** and, during operations, to **monitor all live buses** on a map. Drivers only need a **web browser** on a phone, with an optional **simulated GPS** mode for demos where real GPS is unavailable.

**Block 2 — Architecture**  
The system uses a **single Node.js** server that exposes two interfaces. **HTTP REST** handles registration, login, and all administrative **create-read-update-delete** work for routes, buses, and users, protected by **JWT** role checks. **Socket.IO** carries **real-time** events: drivers **send** trip start, location points, and delay flags; the server **broadcasts** bus position and calculated ETAs to all clients that **subscribed** to that route, and to admins watching the **whole fleet**. **MongoDB** stores user accounts, route geometry and stops, bus assignments, and trip history. To avoid broadcasting every update to every user, the server uses **Socket.IO rooms** named by route, so only interested clients receive each message.

**Block 3 — Real-time sequence**  
A typical session looks like this. The **student** application connects to Socket.IO and sends **`subscribe:route`** with a route id, so the client joins a room. The **driver** starts a **`trip`** for a bus, which sets the bus to an active state and records a trip in the database. On a timer, the driver’s client sends **`location:update`** with latitude and longitude; the server saves the bus position, appends a point to the current trip, computes **ETAs to upcoming stops** using the known stop coordinates and a configurable speed, and emits **`bus:location`** to the route room (and to admin monitors) including the **etas** array. If the driver sends **`status:delay`** (or the server detects missing updates while active), it broadcasts **`bus:delay`** to the same clients. When the **trip** ends, the bus returns to an idle state.

**Block 4 — Technology stack**  
The **front end** is a **Vite** single-page app using **React** and **React Router** for three role-based dashboards, **Leaflet** for **OpenStreetMap**-based maps without a map API key, the browser **`socket.io-client`**, and lightweight UI feedback with **react-hot-toast** for delay alerts. The **back end** uses **Express** for JSON APIs, **Socket.IO** for WebSocket-style events, **Mongoose** to model **MongoDB** collections, **jsonwebtoken** and **bcrypt** for **JWT** and **password** handling. The whole stack is **JavaScript/Node** end to end, which kept development fast and consistent for a small team.

**Block 5 — Design and quality**  
Before coding, we produced **high-level design** in this repository: **user roles**, a **data model** (ERD), a **context** diagram, **layered** view, **end-to-end sequence** for tracking, and notes on **security** (JWT, socket handshake, role middleware). We maintain **unit tests** for **pure logic** like ETA and route simulation, **Mongoose** validation, and **auth** behavior, plus **integration tests** for **HTTP** and **WebSocket** flows (for example, **41** Jest tests in the backend). The **front end** includes tests for the **Login** page, **API** helpers, and **role-gated routes** via **`ProtectedRoute`** (for example, **10** Vitest tests in total). Running **`npm test`** in **backend** and **frontend** gives fast feedback; **GitHub Actions** (`.github/workflows/ci.yml`) runs the same on push and pull requests. This balances **correctness of core logic** with **regression safety** for APIs and the real-time pipeline.

---

## Four people — one feature each (script)

| Person | You own | Say (2–3 sentences) | Show (live) |
|--------|--------|---------------------|------------|
| **1** | Auth & access | JWT is returned from **POST /api/auth/login**; the client stores it; **HTTP** uses `Authorization: Bearer` and the **Socket.IO** handshake passes **`auth.token`**. **ProtectedRoute** in React sends each **role** to the correct dashboard. We test auth in **Jest** and the **Login** + **ProtectedRoute** components with **Vitest**. | You drive: open app, **register or login**; show **student**, **driver**, and **admin** in separate windows or in sequence. |
| **2** | Admin & monitor | **REST** exposes **routes, buses, users, trips** with **admin-only** **POST/PUT/DELETE**. **GET** lists support the admin UI and the **Monitor** page, which needs **all buses** and can hook **Socket.IO** `subscribe:all`. Integration tests in **`api.test.js`** cover **authz** and key resources. | You drive: **Admin** account — **Routes** / **Buses** / **Drivers**, then **Monitor** tab. |
| **3** | Driver & stream | In **`sockets/index.js`**, the driver runs **`trip:start`**, then **`location:update`**; the server updates **Bus** and **Trip**, runs **computeEtas**, and emits **`bus:location`**. **`status:delay`** turns the bus **delayed** and fires **`bus:delay`**. **Simulated** mode in the driver UI follows the route **polyline**. | You drive: **Driver** — select bus, **Simulated**, **Start trip**; wait for **movement**; click **Flag delay**. |
| **4** | Student & ETAs | **`subscribe:route`** joins the **room**; on each **`bus:location`**, the map moves the bus and **stop** UI shows **etas** in seconds. **`bus:delay`** triggers a **toast** and updated status. **etaCalculator** is covered by **unit** tests; **socket** tests verify **broadcast** shape. | You drive: **Student** — same **route** as the driver; point at **marker** and **ETAs**; show **delay** when Owner 3 flags it. |

**HLD slide:** each person adds **one** sentence pointing at **their** box in the diagrams.  
**Testing slide:** each person adds **one** sentence naming **their** test area (see table on slide 8).  
**Q&A:** the person who **built** that part answers first.

---

## Merge options for exactly 10 slides

- **A:** Slides 1, 2, **single slide “Four features”** (four columns: 3A–3D), 4, 5, 6, 7, 8, 9, 10.  
- **B:** Slides 1, 2, 3A, 3B, **one slide 3C+3D** (side by side), then 4–10 (9 slides) — add detail to slide 1 or 6, or **combine 5+6** into one “How it works + stack” slide to reach 10.
