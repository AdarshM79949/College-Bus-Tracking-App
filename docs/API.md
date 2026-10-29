# API & Socket Contracts

Base URL: `http://localhost:4000`

## Auth

All protected endpoints require `Authorization: Bearer <jwt>`.

### POST /api/auth/register

Body: `{ name, email, password, role? }` (role defaults to `student`; `admin` role only creatable via seed).
Returns: `{ token, user }`

### POST /api/auth/login

Body: `{ email, password }`
Returns: `{ token, user }`

### GET /api/auth/me

Returns the current user.

## Routes (admin)

- `GET /api/routes` — list all (any authenticated user)
- `POST /api/routes` — admin only. Body: `{ name, stops: [{name,lat,lng,order}], polyline: [[lat,lng]] }`
- `PUT /api/routes/:id` — admin only
- `DELETE /api/routes/:id` — admin only

## Buses

- `GET /api/buses` — list all buses with current location
- `GET /api/buses/:id` — details
- `POST /api/buses` — admin only. Body: `{ busNumber, routeId, driverId }`
- `PUT /api/buses/:id` — admin only
- `DELETE /api/buses/:id` — admin only

## Users

- `GET /api/users?role=driver` — admin only
- `POST /api/users` — admin only (create driver/admin accounts)

## Trips

- `GET /api/trips?busId=` — history (admin)

---

## Socket.IO Events

Handshake: `io(url, { auth: { token: '<jwt>' } })`

### Client -> Server

| Event              | Payload                              | Role   | Description                             |
| ------------------ | ------------------------------------ | ------ | --------------------------------------- |
| `subscribe:route`  | `{ routeId }`                        | any    | Join room `route:<routeId>`             |
| `unsubscribe:route`| `{ routeId }`                        | any    | Leave the room                          |
| `subscribe:all`    | -                                    | admin  | Monitor all buses                       |
| `trip:start`       | `{ busId }`                          | driver | Create Trip, mark bus active            |
| `trip:end`         | `{ busId }`                          | driver | Close Trip, mark bus idle               |
| `location:update`  | `{ busId, lat, lng, speed? }`        | driver | Push GPS point                          |
| `status:delay`     | `{ busId, reason? }`                 | driver | Flag the bus as delayed                 |

### Server -> Client

| Event         | Payload                                          | Description                             |
| ------------- | ------------------------------------------------ | --------------------------------------- |
| `bus:location`| `{ busId, lat, lng, speed, etas: [{stopId,sec}]}`| Broadcast on every location update      |
| `bus:delay`   | `{ busId, reason }`                              | Delay notification                      |
| `bus:status`  | `{ busId, status }`                              | Status changes (active/idle/delayed)    |
| `error`       | `{ message }`                                    | Auth/validation errors                  |
