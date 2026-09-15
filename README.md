<p align="center">
  <img src="https://raw.githubusercontent.com/Bin-E-Commerce/Bin-E-Commerce-UI-Web/main/public/images/logo/logo_background_white.png" alt="Bin E-Commerce" width="190" />
</p>

<h1 align="center">API Gateway</h1>

<p align="center">
  One trusted front door for Bin E-Commerce: authenticate once, protect every request, and route it to the right service.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white" alt="NestJS 11" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white" alt="TypeScript 5.7" />
  <img src="https://img.shields.io/badge/Redis-5.10-DC382D?logo=redis&logoColor=white" alt="Redis 5.10" />
  <img src="https://img.shields.io/badge/Keycloak-JWT-4D4D4D?logo=keycloak&logoColor=white" alt="Keycloak and JWT" />
  <img src="https://img.shields.io/badge/Socket.IO-4.8-010101?logo=socket.io&logoColor=white" alt="Socket.IO 4.8" />
  <img src="https://img.shields.io/badge/Axios-HTTP-5A29E4?logo=axios&logoColor=white" alt="Axios HTTP client" />
</p>

## Contents

1. [Problem](#1-problem)
2. [Service at a glance](#2-service-at-a-glance)
3. [Core capabilities](#3-core-capabilities)
4. [Trust surface](#4-trust-surface)
5. [See it work](#5-see-it-work)
6. [Install](#6-install)
7. [Getting started](#7-getting-started)
8. [How it works](#8-how-it-works)
9. [Security pipeline](#9-security-pipeline)
10. [Service boundary](#10-service-boundary)
11. [Service communication](#11-service-communication)
12. [Route map](#12-route-map)
13. [Realtime notifications](#13-realtime-notifications)
14. [Project structure](#14-project-structure)
15. [Configuration reference](#15-configuration-reference)
16. [Development](#16-development)
17. [Engineering decisions](#17-engineering-decisions)
18. [Operational notes](#18-operational-notes)
19. [Documentation findings](#19-documentation-findings)
20. [FAQ](#20-faq)
21. [Ownership](#21-ownership)

## 1. Problem

Bin E-Commerce has multiple services, each with its own domain, port, contract and security rules. If the frontend calls every service directly, the client must know internal addresses and repeat authentication, identity forwarding, CORS and retry behavior.

The API Gateway solves that coordination problem with one edge layer:

- the browser only needs one `/api` origin;
- tokens are verified before a request enters the internal service network;
- verified identity is normalized into trusted internal context headers;
- current permissions are resolved from Auth Service instead of being hard-coded in the Gateway;
- requests are routed to the service that owns the business capability;
- realtime notifications use the same public entry point while Redis provides multi-instance fan-out.

The Gateway does not own products, orders or business policies. It owns the edge connection and request protection around those domains.

## 2. Service at a glance

| Property | Value |
| --- | --- |
| Service | `api-gateway` |
| Runtime | Node.js + NestJS 11 |
| Language | TypeScript 5.7 |
| Default HTTP port | `3001` |
| External prefix | `/api` |
| API versioning | URI versioning, default `v1` |
| API documentation | `/docs` outside production |
| Health check | `/api/health` |
| Authentication | Keycloak JWKS + JWT RS256 |
| Rate limiting | Redis-backed throttling, default 100 requests / 60 seconds |
| Realtime | Socket.IO namespace `/notifications` |
| Business persistence | None owned by the Gateway |

### The service objective

For every request, the Gateway should answer three questions:

1. Is this request allowed to enter the system?
2. Which user or session does this request belong to, and what context must downstream receive?
3. Which service owns the requested contract?

## 3. Core capabilities

### 3.1. One HTTP entry point

The global `/api` prefix and URI versioning provide a stable client contract such as `/api/v1/...`. Proxy controllers route requests, forward the permitted body/query/headers, and preserve the upstream status and response data.

### 3.2. JWT verification with Keycloak JWKS

The Gateway loads public keys from Keycloak JWKS and verifies the issuer, signature and `RS256` algorithm. After successful verification, the authenticated identity is attached to the request context.

Client-supplied identity headers are not trusted. Headers such as `x-user-id` are accepted as trusted context only after the Gateway has verified the token and injected its own values.

### 3.3. Dynamic permission resolution

Token roles are normalized and the Gateway can call `GET /api/v1/auth/me` on Auth Service to resolve the latest permission, display name and avatar context. Routes decorated with `@RequirePermissions(...)` are checked by `PermissionsGuard` before forwarding.

### 3.4. Consistent proxy behavior

`ProxyService` centralizes HTTP forwarding, allowed-header selection, response preservation and connection error handling. A downstream network failure is converted into `503 Service Unavailable`; a business `4xx` or `5xx` response remains visible to the client.

### 3.5. Edge protection

The service applies Helmet, an allow-listed CORS policy, CSRF protection for state-changing requests and Redis-backed throttling. These protections run at the global boundary so every module follows the same baseline.

### 3.6. Realtime notifications

Socket.IO authenticates the handshake, joins user/role/permission rooms and receives events from Redis pub/sub. With multiple Gateway instances, each instance subscribes independently and emits to the clients connected to that instance.

## 4. Trust surface

<details>
<summary>What does the Gateway trust, and what does it reject?</summary>

The Gateway trusts the following only after validating their source:

- JWT signature, issuer and expiration issued by Keycloak;
- identity and permissions resolved for the verified user;
- internal context headers injected by the Gateway after the guard pipeline;
- upstream response status and data, without treating them as Gateway-owned business truth.

The Gateway rejects or ignores:

- `x-user-id`, `x-user-roles` and `x-user-permissions` supplied by a browser;
- permissions inferred from a role string without the configured authorization flow;
- origins that are not included in `ALLOWED_ORIGINS`;
- mutation requests that do not satisfy the CSRF request marker policy;
- WebSocket tokens supplied through a query string.

</details>

## 5. See it work

### 5.1. Start the Gateway

```powershell
cd services/api-gateway
Copy-Item .env.example .env
npm install
npm run dev
```

### 5.2. Check health

```powershell
curl http://localhost:3001/api/health
```

The health endpoint confirms that the process is listening and returns basic environment information. It does not replace a full Keycloak, Redis or downstream dependency check.

### 5.3. Open API documentation

When running outside production, open:

```text
http://localhost:3001/docs
```

Swagger includes bearer authentication for protected routes. Use an access token issued by Keycloak; do not use a fabricated token or manually created identity headers.

### 5.4. Call a route through the Gateway

```powershell
curl http://localhost:3001/api/v1/products
```

For a protected route:

```powershell
curl http://localhost:3001/api/v1/products \
  -H "Authorization: Bearer <keycloak-access-token>"
```

The final response depends on Product Service and the data available in the running environment.

## 6. Install

> [!IMPORTANT]
> The Gateway depends on runtime services outside its process: Keycloak for JWKS verification, Redis for throttling and realtime delivery, and the downstream HTTP services for the routes being tested. The Gateway does not own a business database.

### Prerequisites

- Node.js and npm versions supported by the workspace.
- A Keycloak realm named `bin-ecommerce` that issues access tokens.
- Redis reachable through `REDIS_HOST` and `REDIS_PORT`.
- Auth Service available for dynamic permission resolution.
- Any downstream service required by the route under test.

### Reversibility

The Gateway is stateless at the application layer. It can be stopped, reconfigured or moved to another instance without rolling back Gateway-owned business data because it owns none. Business-data rollback belongs to the service that owns that data.

## 7. Getting started

### Minimal local run

To verify bootstrap and health, run the Gateway with Redis and the minimum `.env` configuration. Protected routes additionally require Keycloak and Auth Service. Proxy routes also require the selected downstream service to be available at its configured URL.

```powershell
cd services/api-gateway
Copy-Item .env.example .env
npm run dev
```

### Recommended verification order

1. Call `/api/health` and confirm the process is listening.
2. Open `/docs` and verify route metadata.
3. Call a public or guest route.
4. Authenticate through Keycloak/Auth Service and obtain an access token.
5. Authorize the token in Swagger or send it with curl.
6. Inspect Gateway and downstream status codes while testing a business route.

### Production build

```powershell
npm run build
npm run start
```

Swagger is not exposed in production because `main.ts` registers `/docs` only outside the `production` environment.

## 8. How it works

```text
Client request
    │
    ▼
ThrottlerGuard ───────► Redis rate-limit counter
    │
    ▼
CsrfGuard ────────────► mutation request policy
    │
    ▼
JwtAuthGuard ─────────► Keycloak JWKS + Auth Service context
    │
    ▼
PermissionsGuard ─────► route permission metadata
    │
    ▼
ProxyService ─────────► downstream service
    │
    ▼
Preserved upstream response
```

The global `/api` prefix is applied before controller routes. URI versioning adds `v1` to versioned routes. The health controller remains available at `/api/health` because it is not placed in the versioned controller group.

### 8.1. Forwarding flow

`ProxyService.forward()` preserves the method, body, query and allowed headers. The Gateway adds verified identity context and calls Axios with status validation configured to preserve the upstream status.

```text
Client request
  → validate and enrich trusted context
  → Axios downstream request
  → upstream response: preserve status, data and allowed headers
  → network error: return 503 Service Unavailable
```

Binary responses such as shipping labels use `forwardBinary()` to preserve the `arraybuffer` body and required content headers.

## 9. Security pipeline

### 9.1. Guard order

The current global order is an important invariant:

| Order | Guard | Responsibility |
| --- | --- | --- |
| 1 | `ThrottlerGuard` | Limit request frequency using Redis storage |
| 2 | `CsrfGuard` | Reject mutations without a valid request marker |
| 3 | `JwtAuthGuard` | Verify JWT, resolve context and handle guest access |
| 4 | `PermissionsGuard` | Check permissions declared by route metadata |

Changing this order can cause permission checks to run before identity injection or allow invalid requests to travel further than necessary.

### 9.2. JWT and JWKS

`JwksService` builds the issuer from `KEYCLOAK_URL` and `KEYCLOAK_REALM` and reads the certificate endpoint:

```text
{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/certs
```

The JWKS client caches public keys for up to one hour and limits key refresh requests. Tokens must have the expected issuer and use `RS256`. Roles can be read from direct claims, `realm_access` and `resource_access`, then normalized into business roles.

### 9.3. Identity headers

The trusted context may include:

```text
x-user-id
x-user-email
x-user-roles
x-user-permissions
x-session-id
x-request-id
```

Downstream services must treat these as Gateway-provided context, not as user-editable data. The Auth Service remains the source of permission truth.

### 9.4. CORS, Helmet and CSRF

- Helmet adds baseline HTTP security headers.
- CORS uses the `ALLOWED_ORIGINS` allow-list and supports credentials where configured.
- `GET`, `HEAD` and `OPTIONS` do not require the CSRF marker.
- Mutation requests require `X-Requested-With: XMLHttpRequest`, except routes explicitly decorated with `@SkipCsrf()`.
- Guest routes are explicitly marked with `@AllowGuest()` and cannot retain spoofable identity headers.

## 10. Service boundary

### The Gateway owns

- The public edge contract and API version prefix.
- Route aggregation for exposed domain services.
- JWT verification and trusted context propagation.
- Permission checks at the edge boundary.
- CORS, Helmet, CSRF, throttling and graceful shutdown.
- Health checks and the development Swagger surface.
- The Socket.IO notification namespace and Redis subscriber at the edge.

### The Gateway does not own

- Credentials or the source of role/permission truth: Keycloak and Auth Service own these concerns.
- Product, cart, order, shipping, seller or recommendation data.
- A business database or business migrations.
- AI models, ranking policy or candidate-generation rules.
- Downstream transactions, compensation logic or domain-specific retry policy.

Keep proxy controllers thin. If a rule has meaning only inside a domain, implement it in the owning domain service rather than adding business branches to the Gateway.

## 11. Service communication

| Downstream | Configuration | Gateway responsibility |
| --- | --- | --- |
| Keycloak | `KEYCLOAK_URL` | JWKS verification |
| Auth Service | `AUTH_SERVICE_URL` | Auth flows, users, admin access and permission lookup |
| Catalog Service | `CATALOG_SERVICE_URL` | Category and catalog proxy routes |
| Media Service | `MEDIA_SERVICE_URL` | Media proxy routes |
| Notification Service | `NOTIFICATION_SERVICE_URL` | Notification feed and actions |
| Recommendation Service | `RECOMMENDATION_SERVICE_URL` | Events, recommendations and admin policy proxy |
| Seller Service | `SELLER_SERVICE_URL` | Seller onboarding, shop and shipping settings |
| Product Service | `PRODUCT_SERVICE_URL` | Products, reviews and seller product APIs |
| AI Service | `AI_SERVICE_URL` | Seller content and image-optimization APIs |
| Cart Service | `CART_SERVICE_URL` | Cart APIs |
| Order Service | `ORDER_SERVICE_URL` | Customer and seller order APIs |
| Shipping Service | `SHIPPING_SERVICE_URL` | Shipment, tracking and location APIs |

The Gateway does not perform service discovery. Proxy modules read URLs from `ConfigService`, so an invalid URL appears as an upstream error or `503` response.

### Asynchronous and realtime communication

The Gateway does not own the business event bus. Realtime notification delivery uses the Redis channel configured by `NOTIFICATION_REALTIME_CHANNEL`. A subscriber parses each message and emits it to the matching Socket.IO rooms. If realtime Redis subscription is unavailable, the REST notification feed remains an independent fallback.

## 12. Route map

The route families below are combined with `/api/v1`, except for `/api/health`. They describe the current Gateway controllers, not every private endpoint inside downstream services.

| Domain | Route families |
| --- | --- |
| Auth and account | `/auth/*`, `/users/*`, `/admin/users/*`, `/admin/access-control/*` |
| Catalog and media | `/categories/*`, `/media/*`, `/notifications/*` |
| Shops | `/shops`, `/shops/:identifier`, `/shops/:identifier/follow` |
| Products | `/products`, `/products/:id`, `/products/brands`, seller product routes |
| Reviews | Product review, review media cleanup and review-like routes |
| Cart | `/cart`, `/cart/items`, `/cart/items/:itemId` |
| Customer orders | `/orders/quote`, `/orders`, `/orders/:orderId`, cancel, returns and delivery confirmation |
| Seller orders | `/seller/orders`, `/seller/orders/:orderId`, seller return actions |
| Seller | `/seller/applications/*`, `/seller/shop/profile/*`, `/seller/shipping/*` |
| Shipping | Shipment creation, tracking and `/shipping/locations/*` |
| AI content | `/seller/ai/product-content/*` |
| AI image optimization | `/seller/ai/image-optimization/*` |
| Recommendation | `/recommendation/events`, batch events, recommendations and profile merge |
| Admin recommendation | `/admin/recommendation/overview`, `config`, history, rollback and experiments |

For the exact method and permission contract, use Swagger in development and the controller/DTO implementation in this repository.

## 13. Realtime notifications

### Client connection

Clients connect to the `/notifications` namespace and send the access token in the Socket.IO handshake:

```typescript
const socket = io("http://localhost:3001/notifications", {
  auth: { token: accessToken },
});
```

Do not put tokens in a query string because query values can appear in logs, proxy traces or browser history.

### Rooms and audiences

After the handshake is verified, the Gateway can place a socket into rooms for a user, role, permission, broadcast or shop audience. Publishers can target those audiences, while the connected Gateway instance emits to the clients it currently owns.

## 14. Project structure

```text
src/
├── main.ts                         # Bootstrap, global prefix, versioning and Swagger
├── app.module.ts                   # Root module and dependency composition
├── common/                         # Shared decorators, guards, filters and constants
├── config/                         # Environment parsing and configuration factories
├── health/                         # Health controller and health checks
├── modules/                        # Gateway features grouped by responsibility
│   ├── auth/                        # JWT, JWKS and authentication context
│   ├── permissions/                # Permission metadata and permission guard
│   ├── proxy/                      # HTTP forwarding and downstream adapters
│   ├── notifications/              # Socket.IO and Redis realtime delivery
│   └── ...                          # Domain-specific proxy modules
└── infrastructure/                # Redis, Axios and external integration setup
```

The exact folder names may grow with the route surface, but the ownership rule stays stable: guards protect the edge, proxy adapters forward contracts, and domain services own business rules.

## 15. Configuration reference

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP listen port |
| `NODE_ENV` | Runtime environment and Swagger exposure |
| `API_PREFIX` | External API prefix, normally `/api` |
| `KEYCLOAK_URL` | Keycloak base URL |
| `KEYCLOAK_REALM` | Keycloak realm |
| `KEYCLOAK_CLIENT_ID` | OIDC client context when required |
| `REDIS_HOST` / `REDIS_PORT` | Redis connection |
| `ALLOWED_ORIGINS` | CORS allow-list |
| `AUTH_SERVICE_URL` | Auth Service base URL |
| `PRODUCT_SERVICE_URL` | Product Service base URL |
| `CATALOG_SERVICE_URL` | Catalog Service base URL |
| `CART_SERVICE_URL` | Cart Service base URL |
| `ORDER_SERVICE_URL` | Order Service base URL |
| `SHIPPING_SERVICE_URL` | Shipping Service base URL |
| `SELLER_SERVICE_URL` | Seller Service base URL |
| `MEDIA_SERVICE_URL` | Media Service base URL |
| `NOTIFICATION_SERVICE_URL` | Notification Service base URL |
| `RECOMMENDATION_SERVICE_URL` | Recommendation Service base URL |
| `AI_SERVICE_URL` | AI Service base URL |
| `NOTIFICATION_REALTIME_CHANNEL` | Redis pub/sub channel for notifications |

Use `.env.example` as the source of truth for names and defaults. Never commit access tokens, private keys, internal service tokens or production provider credentials.

## 16. Development

```powershell
npm run lint
npm run type-check
npm test
npm run build
```

When changing a proxy route, verify all of the following:

1. The route has the expected version and prefix.
2. The correct downstream URL is used.
3. Public, guest and authenticated access are explicitly distinguished.
4. Permission metadata matches the Auth Service contract.
5. Spoofable client headers are overwritten or removed.
6. Upstream status codes and error bodies remain meaningful.
7. Binary content types are preserved where required.
8. Tests cover both successful forwarding and downstream failure.

## 17. Engineering decisions

### Why keep the Gateway thin?

The Gateway is a policy and transport boundary, not a second domain service. Thin proxy modules reduce duplication and ensure that product, order, seller and recommendation invariants remain in their owners.

### Why verify JWT at the edge and downstream?

Edge verification provides fast rejection and consistent context propagation. Downstream verification and authorization remain necessary because an internal caller must not be able to bypass the domain service boundary.

### Why resolve permissions dynamically?

Roles and permissions can change without waiting for a stale browser token or hard-coded Gateway mapping to expire. Auth Service provides the latest application-level authorization context.

### Why use Redis for throttling and realtime?

Redis provides shared counters and pub/sub behavior across Gateway instances. This prevents each instance from applying an isolated rate limit or missing notifications published by another instance.

## 18. Operational notes

- A `401` usually indicates a missing, expired or invalid token.
- A `403` usually indicates a valid identity without the required permission.
- A `429` indicates throttling; inspect Redis connectivity and the configured limits.
- A `503` commonly indicates that the Gateway cannot reach the configured downstream service.
- A valid downstream `4xx/5xx` should remain visible rather than being mistaken for a Gateway success.
- Missing JWKS connectivity can prevent authenticated traffic while public routes may still respond.
- Missing Redis affects throttling or realtime behavior depending on the failing integration.

Log correlation IDs, route, upstream service, status and latency. Never log bearer tokens, passwords, private keys or internal service tokens.

## 19. Documentation findings

The following documents provide context around this service:

| Topic | Location |
| --- | --- |
| Gateway authentication and proxy behavior | `docs/features/api-gateway/` |
| Gateway health checks | `docs/features/api-gateway/health.md` |
| JWT/RBAC architecture | `docs/features/auth/AUTH-RBAC-ARCHITECTURE_V2.md` |
| Keycloak setup | `docs/architecture/KEYCLOAK_SETUP.md` |
| Kafka integration | `docs/architecture/KAFKA_GUIDE.md` |
| Repository system overview | `docs/architecture/CODEBASE_OVERVIEW.md` |

When implementation and documentation disagree, verify the active module, `.env.example` and tests before updating this README.

## 20. FAQ

### Does the browser call services directly?

No. The browser calls the Gateway, which forwards the request to the owning service.

### Is the Gateway the source of authorization truth?

No. It enforces the edge boundary, while Keycloak and Auth Service provide identity and application permission context. Downstream services must enforce their own business authorization as well.

### Can the Gateway run without every service?

Yes, for bootstrap and health checks. A specific proxy route requires its downstream service and any dependencies needed by that service.

### Why did a downstream error become `503`?

A `503` normally means the Gateway could not establish or complete the network call. If the downstream returned a business status, the Gateway should preserve that upstream status.

### Can Swagger be used in production?

No. Swagger is registered only outside the production environment.

## 21. Ownership

### Engineering

**Đào Ngọc Anh**

Software Engineer responsible for the API Gateway architecture, security pipeline, service proxy boundaries, request context propagation, realtime notification edge and maintenance of this service.

[View portfolio](https://daongocanh.site)
