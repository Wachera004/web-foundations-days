# TicketHub System Design

TicketHub sells tickets for concerts and other events. This design focuses on keeping seat inventory correct and giving customers fair access when demand is much higher than supply.

## 1. Requirements

### Functional requirements
- Visitors can browse and search upcoming events and view event details.
- Customers can see a seat map and the current availability of seats.
- A signed-in customer can place a temporary hold on an available seat, then place an order and pay before the hold expires.
- Customers can view their confirmed tickets.
- The system expires abandoned holds and makes those seats available again.

### Non-functional requirements
- **Speed:** Event browsing should respond within 200 ms at the 95th percentile when cached. Seat-map and hold requests should respond within 500 ms at the 95th percentile under normal load.
- **Correctness:** A seat can have at most one active hold and at most one confirmed order. The database is the source of truth for seat ownership; cached availability is informational only.
- **Fairness:** During a high-demand sale, customers enter a FIFO waiting room and are admitted in queue order at a controlled rate. Retries keep the same queue position and idempotency key; customers cannot gain priority by refreshing.
- **Availability:** Target 99.9% monthly availability for browsing and checkout APIs. If the inventory database is unavailable, checkout fails clearly rather than claiming a seat was reserved.
- **Security:** Require authentication for holds, orders, and tickets; authorize access to a customer's own records; rate-limit requests and protect payment details by using a payment provider.

## 2. Traffic estimates

### Normal day
- Registered users: **2,000,000**.
- **50,000 visitors x 10 pages = 500,000 page views/day.**
- Average page-view rate: 500,000 / 86,400 seconds = **about 5.8 page views/second**. This is a daily average, not a peak.
- **5,000 tickets/day** = about **0.058 ticket sales/second**, also a daily average.

### Popular-concert sale
- **200,000 people / 600 seconds = about 333 buyer attempts/second on average** during the first 10 minutes.
- There are **20,000 seats**, so demand is **10 buyers per seat**. If each buyer wants one seat, at most 10% can get one.
- The average buyer-attempt rate is about **57 times** the normal average page-view rate. The successful sale rate needed to sell all 20,000 seats in 10 minutes is about **33 tickets/second**, roughly **576 times** the normal average ticket-sale rate.
- Buyer attempts are not the same as HTTP requests: each buyer may browse, load a seat map, request a hold, and submit an order, and some will retry. The sale infrastructure is therefore sized and load-tested for at least **2,000 API requests/second** as a design target, with admission control to protect inventory and payment services. The provided figures do not specify the instantaneous peak, so this target is an explicit capacity assumption, not a measured peak.

## 3. API design

All endpoints use HTTPS. Authenticated endpoints derive the customer identity from the access token, not a user ID supplied by the caller. JSON examples show the main fields; errors include a stable error code.

| Method and path | Purpose and example behavior |
| --- | --- |
| `GET /events?query=&from=&to=&page=` | Browse/search events. Returns event summaries and pagination metadata (`200 OK`). |
| `GET /events/{eventId}` | Return event details, venue, date, and sale status (`200 OK`, or `404 Not Found`). |
| `GET /events/{eventId}/seats` | Return the seat map and an availability snapshot (`200 OK`). Snapshot data can be briefly stale; the hold endpoint makes the authoritative decision. |
| `POST /events/{eventId}/seats/{seatId}/holds` | Authenticated request to hold a seat. Requires an `Idempotency-Key` header. Returns `201 Created` with `holdId` and `expiresAt`; returns `409 Conflict` if the seat is booked or actively held. |
| `POST /orders` | Authenticated checkout with `holdId` and payment method token. Requires an `Idempotency-Key` header. Returns `201 Created` when confirmed or `202 Accepted` while payment confirmation is pending; returns `409 Conflict` if the hold is invalid or expired. |
| `GET /me/tickets` | Return the authenticated customer's confirmed tickets and ticket IDs/QR-code data (`200 OK`). |

Repeating a hold or order request with the same idempotency key returns the original result instead of creating a second hold or charging twice.

## 4. Data model and double-booking prevention

PostgreSQL is the authoritative store. Primary keys are UUIDs. The main relationships are:

- One **user** can own many **orders** and many **seat holds**.
- One **event** has many **seats**.
- One **seat** can have historical holds and orders, but only one active hold and one confirmed order at a time.
- One **seat hold** belongs to one user and one seat; an order references the hold used at checkout.

Core columns and constraints:

1. **`users`**: `id` primary key, `email` unique and not null, `password_hash`, `created_at`.
2. **`events`**: `id` primary key, `title`, `description`, `starts_at`, `venue`, `sale_status`.
3. **`seats`**: `id` primary key, `event_id` foreign key, `seat_number`, `status` (`available`, `held`, `booked`); unique (`event_id`, `seat_number`).
4. **`seat_holds`**: `id` primary key, `seat_id` foreign key, `user_id` foreign key, `status` (`active`, `consumed`, `expired`, `cancelled`), `expires_at`, `idempotency_key`, `created_at`. A partial unique index allows only one active hold per seat; unique (`user_id`, `idempotency_key`) makes hold retries safe.
5. **`orders`**: `id` primary key, `user_id` foreign key, `seat_id` foreign key, `hold_id` unique foreign key, `status` (`pending`, `confirmed`, `cancelled`), `payment_status` (`pending`, `authorized`, `failed`, `refunded`), `idempotency_key`, `created_at`. Unique (`user_id`, `idempotency_key`) prevents duplicate orders on client retries; a partial unique index allows only one confirmed order per seat.

### Atomic hold and purchase flow

1. To place a hold, the inventory service starts a database transaction and locks the seat row with `SELECT ... FOR UPDATE`. It rejects a booked seat or an unexpired active hold. If a previous hold has expired, it marks that hold expired. It then inserts the new active hold and changes the seat to `held` before committing. The active-hold unique index is a second safeguard.
2. Because requests for the same seat serialize on its row lock, two customers cannot both observe and claim it as available. Only the transaction that commits the hold succeeds; the other receives `409 Conflict`. The hold has a five-minute expiry, after which a cleanup worker marks it expired and returns the seat to `available` in a transaction.
3. Checkout verifies that the authenticated user owns the unexpired hold. The payment provider authorizes payment outside the database transaction; the system does not keep a database lock open during a network call. A final transaction locks the seat and hold, confirms the order, marks the hold consumed, and marks the seat booked. The partial unique index on confirmed orders is a final database-level invariant.
4. If authorization fails, the order is not confirmed and the hold can be released or allowed to expire. If authorization succeeds but the hold expires before confirmation, the system does not issue the ticket and voids/refunds the authorization. Payment calls and client retries use idempotency keys.

The following PostgreSQL-style DDL illustrates the important constraints (application code performs the transactions above):

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE events (
    id UUID PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    starts_at TIMESTAMPTZ NOT NULL,
    venue TEXT NOT NULL,
    sale_status TEXT NOT NULL CHECK (sale_status IN ('scheduled', 'open', 'closed'))
);

CREATE TABLE seats (
    id UUID PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    seat_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'available'
        CHECK (status IN ('available', 'held', 'booked')),
    UNIQUE (event_id, seat_number)
);

CREATE TABLE seat_holds (
    id UUID PRIMARY KEY,
    seat_id UUID NOT NULL REFERENCES seats(id),
    user_id UUID NOT NULL REFERENCES users(id),
    status TEXT NOT NULL CHECK (status IN ('active', 'consumed', 'expired', 'cancelled')),
    expires_at TIMESTAMPTZ NOT NULL,
    idempotency_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX one_active_hold_per_seat
    ON seat_holds(seat_id) WHERE status = 'active';
CREATE UNIQUE INDEX one_hold_request_per_user_key
    ON seat_holds(user_id, idempotency_key);

CREATE TABLE orders (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    seat_id UUID NOT NULL REFERENCES seats(id),
    hold_id UUID NOT NULL UNIQUE REFERENCES seat_holds(id),
    status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'cancelled')),
    payment_status TEXT NOT NULL
        CHECK (payment_status IN ('pending', 'authorized', 'failed', 'refunded')),
    idempotency_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, idempotency_key)
);
CREATE UNIQUE INDEX one_confirmed_order_per_seat
    ON orders(seat_id) WHERE status = 'confirmed';
```

## 5. Architecture

```text
                         +----------------------+
                         | Customers / browsers |
                         +----------+-----------+
                                    |
                         +----------v-----------+
                         | CDN: static files and|
                         | cached event catalog |
                         +----------+-----------+
                                    |
                         +----------v-----------+
                         | WAF, rate limiter,   |
                         | FIFO sale waiting room|
                         +----------+-----------+
                                    |
                         +----------v-----------+
                         | Load balancer        |
                         +----+-------------+---+
                              |             |
                    +---------v--+       +--v-----------+
                    | Stateless  |       | Catalog/read |
                    | API servers|       | service      |
                    +-----+------+       +------+-------+
                          |                     |
                    +-----v------+       +------v-------+
                    | Inventory  |       | Read replica |
                    | service    |       | / cache      |
                    +-----+------+       +--------------+
                          |
                    +-----v----------------+
                    | PostgreSQL primary   |
                    | seats, holds, orders |
                    +-----+----------------+
                          |
                  +-------v---------+       +-----------------+
                  | Outbox / worker |------>| Payment provider|
                  +-----------------+       +-----------------+
```

- **CDN and catalog/read service:** Serve static assets and cache event descriptions and read-heavy catalog results. Seat-map snapshots may be cached briefly, but are never used to authorize a hold.
- **WAF, rate limiter, and FIFO waiting room:** Filter abusive traffic, keep each visitor's queue token, and admit sale traffic at a rate the inventory and payment systems can sustain. This protects the origin and preserves queue order instead of letting refreshes win.
- **Load balancer and stateless API servers:** Spread requests across horizontally scalable instances. Stateless servers can be added during the sale; authentication and idempotency are handled consistently across instances.
- **Inventory service and PostgreSQL primary:** Route all hold and booking writes through one authoritative transactional database path. Row locks and unique constraints decide the winner for each seat. A read replica/cache can serve browse and availability reads, but never writes.
- **Outbox/worker and payment provider:** Persist checkout intent in the same database transaction as the order, then let workers call the payment provider with retries and idempotency. This avoids losing payment work if an API server stops; order confirmation still uses the inventory transaction.

During the sale, the queue limits admitted write traffic, stateless API instances scale horizontally, and cached reads absorb catalog demand. The single inventory authority deliberately serializes changes to each seat, preventing overselling even when requests arrive on different servers. If it is overloaded or unavailable, the waiting room slows admission and checkout reports a retryable error rather than making an unsafe reservation.

## 6. Trade-offs

1. **Strict inventory correctness vs. write availability:** A single authoritative transactional database and per-seat locking can limit write throughput, but they make seat ownership easy to reason about and prevent double-booking. For this workload, controlled admission is preferable to accepting writes that could oversell.
2. **Fair FIFO queue vs. instant access:** A waiting room adds delay for some customers and requires queue-token management, but it prevents refresh/retry races from overwhelming checkout and gives customers a consistent order of admission.
3. **Cached reads vs. freshest availability:** Caching event and seat-map data lowers latency and database load, but a displayed seat can become unavailable before checkout. The hold endpoint always rechecks inventory transactionally and reports a conflict when necessary.
