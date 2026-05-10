# API Gateway — Bin E-Commerce

> Every request from the outside world passes through here. The API Gateway is the **single entry point** for all client traffic: it verifies JWTs issued by Keycloak, enforces rate limits, and reverse-proxies to the correct microservice — so no service behind it needs to know how authentication works.

---

## What problem it solves

Without a gateway, every microservice must independently verify tokens, handle CORS, and implement rate limiting. When auth logic changes (key rotation, issuer update, new claim structure), you'd have to redeploy all 9 services at once.

The gateway centralises these cross-cutting concerns into one place. The 9 downstream services receive pre-validated, trusted requests with user context already injected in headers.

---

## Architecture

```
Internet
   │
   ▼
┌──────────────────────────────┐
│         Nginx :80/:443       │  Rate limit: 100 req/min global
│    (reverse proxy + TLS)     │             10 req/min /auth/*
└──────────────┬───────────────┘
               │  X-Real-IP, X-Forwarded-For
               ▼
┌──────────────────────────────────────────────────────┐
│              API Gateway  :3000                      │
│                                                      │
│  ┌─────────────────┐    ┌──────────────────────────┐ │
│  │  JwtAuthGuard   │    │      ThrottlerGuard       │ │
│  │  (global)       │    │  100 req/60s per real IP  │ │
│  └────────┬────────┘    └──────────────────────────┘ │
│           │ verifies RS256 JWT                        │
│           ▼                                           │
│  ┌─────────────────┐                                  │
│  │   JwksService   │◄── Keycloak JWKS cache 1h        │
│  └────────┬────────┘                                  │
│           │ injects X-User-Id / X-User-Email /        │
│           │         X-User-Roles headers              │
│           ▼                                           │
│  ┌─────────────────┐                                  │
│  │  ProxyService   │  forwards method + body +        │
│  │  (@nestjs/axios)│  query + headers downstream      │
│  └────────┬────────┘                                  │
└───────────┼──────────────────────────────────────────┘
            │
     Route table
     ┌───────────────────────────────────┐
     │ /api/v1/auth/*    → auth    :3001  │
     │ /api/v1/products/*→ product :3002  │
     │ /api/v1/cart/*    → cart    :3003  │
     │ /api/v1/orders/*  → order   :3004  │
     │ /api/v1/inventory→ inventory:3005  │
     │ /api/v1/notif/*   → notif.  :3006  │
     │ /api/v1/shipping/*→ shipping:3007  │
     │ /api/v1/promos/*  → promo   :3008  │
     │ /api/v1/returns/* → return  :3009  │
     │ /api/health       → (local)        │
     └───────────────────────────────────┘
```

---

## Features

| Feature                    | Detail                                                                        |
| -------------------------- | ----------------------------------------------------------------------------- |
| **JWT verification**       | RS256, public key fetched from Keycloak JWKS endpoint, cached 1 h             |
| **Rate limiting**          | 100 requests / 60 s per real client IP via `@nestjs/throttler`                |
| **Proxy**                  | Forwards original method, body, query params, and headers — no data loss      |
| **User context injection** | `X-User-Id`, `X-User-Email`, `X-User-Roles` injected after verification       |
| **Public routes**          | `@Public()` decorator skips JWT check (e.g., `/auth/login`, `/auth/register`) |
| **Health check**           | `GET /api/health` — liveness probe via `@nestjs/terminus`                     |
| **Swagger**                | `GET /api/docs` — available in non-production environments only               |
| **Graceful shutdown**      | SIGTERM/SIGINT handled cleanly                                                |
| **Trust proxy**            | `trust proxy = 1` ensures ThrottlerModule reads real client IP, not Nginx's   |
