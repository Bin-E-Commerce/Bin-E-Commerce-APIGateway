<p align="center">
  <img src="../../web/public/images/logo/logo_background_white.png" alt="Bin E-Commerce" width="190" />
</p>

<h1 align="center">API Gateway</h1>

<p align="center">
  One trusted front door for Bin E-Commerce: authenticate once, protect every request, and route it to the right service.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white" alt="NestJS 11" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Redis-5.10-DC382D?logo=redis&logoColor=white" alt="Redis" />
  <img src="https://img.shields.io/badge/Keycloak-JWT-4D4D4D?logo=keycloak&logoColor=white" alt="Keycloak and JWT" />
  <img src="https://img.shields.io/badge/Socket.IO-4.8-010101?logo=socket.io&logoColor=white" alt="Socket.IO" />
  <img src="https://img.shields.io/badge/Axios-HTTP-5A29E4?logo=axios&logoColor=white" alt="Axios" />
</p>

## Contents

1. [Problem](#1-problem)
2. [Service at a glance](#2-service-at-a-glance)
3. [Core capabilities](#3-core-capabilities)
4. [Trust surface](#4-trust-surface)
5. [See It Work](#5-see-it-work)
6. [Install](#6-install)
7. [Getting Started](#7-getting-started)
8. [How It Works](#8-how-it-works)
9. [Security Pipeline](#9-security-pipeline)
10. [Service Boundary](#10-service-boundary)
11. [Service Communication](#11-service-communication)
12. [Route Map](#12-route-map)
13. [Realtime Notifications](#13-realtime-notifications)
14. [Project Structure](#14-project-structure)
15. [Configuration Reference](#15-configuration-reference)
16. [Development](#16-development)
17. [Engineering Decisions](#17-engineering-decisions)
18. [Operational Notes](#18-operational-notes)
19. [Documentation Findings](#19-documentation-findings)
20. [FAQ](#20-faq)
21. [Ownership](#21-ownership)

## 1. Problem

Bin E-Commerce có nhiều microservice, mỗi service có domain, port, contract và cơ chế bảo vệ riêng. Nếu frontend gọi trực tiếp từng service, client sẽ phải biết quá nhiều địa chỉ nội bộ và tự lặp lại các bước xác thực, forward identity, xử lý CORS hoặc retry.

API Gateway giải quyết bài toán đó bằng một edge layer duy nhất:

- Browser chỉ cần biết một origin `/api`.
- Token được kiểm tra tại một điểm trước khi request đi sâu vào hệ thống.
- Identity context được chuẩn hóa thành các header nội bộ để downstream không phải giải mã token lại.
- Permission động được lấy từ Auth Service, không hard-code ở Gateway.
- Route được chuyển đến service sở hữu nghiệp vụ thay vì đưa business logic vào gateway.
- Notification realtime đi qua cùng một entry point nhưng vẫn dùng Redis để fan-out giữa nhiều instance.

Gateway không phải nơi lưu sản phẩm, đơn hàng hay policy nghiệp vụ. Nó là lớp kiểm soát và kết nối ở biên hệ thống.

## 2. Service at a glance

| Thuộc tính | Giá trị |
| --- | --- |
| Service | `api-gateway` |
| Runtime | Node.js + NestJS 11 |
| Language | TypeScript 5.7 |
| HTTP port mặc định | `3001` |
| External prefix | `/api` |
| API versioning | URI versioning, mặc định `v1` |
| API docs | `/docs` khi `NODE_ENV` khác `production` |
| Health check | `/api/health` |
| Authentication | Keycloak JWKS + JWT RS256 |
| Rate limiting | Redis-backed throttling, mặc định 100 request / 60 giây |
| Realtime | Socket.IO namespace `/notifications` |
| Persistence ownership | Không sở hữu database nghiệp vụ |

### Mục tiêu của service

Gateway nên trả lời tốt ba câu hỏi cho mỗi request:

1. Request này có được phép đi vào hệ thống không?
2. Request này thuộc user/session nào và downstream cần biết context gì?
3. Request này phải được chuyển đến service nào, với contract nào?

## 3. Core capabilities

### 3.1. Một cửa cho HTTP API

Global prefix `/api` và URI versioning giúp các client dùng contract ổn định dạng `/api/v1/...`. Controller proxy chỉ định tuyến, forward body/query/header và trả nguyên status/data/header phù hợp từ upstream.

### 3.2. Xác thực JWT tập trung

Gateway tải public key từ Keycloak JWKS, kiểm tra issuer và thuật toán `RS256`, sau đó đặt identity đã xác minh vào request context. Client không thể tự gửi `x-user-id` để giả danh vì các header context chỉ được chấp nhận sau bước verify và header bổ sung từ Gateway được áp sau header của client.

### 3.3. Permission động

Role trong token được chuẩn hóa, sau đó Gateway gọi `GET /api/v1/auth/me` của Auth Service để lấy permission/name/avatar mới nhất. Route có `@RequirePermissions(...)` được kiểm tra bởi `PermissionsGuard` trước khi forward.

### 3.4. Proxy thống nhất

`ProxyService` gom logic HTTP forwarding, chọn header được phép chuyển tiếp, giữ status/data/response headers từ upstream và chuyển lỗi kết nối thành `503 Service Unavailable`.

### 3.5. Bảo vệ lớp edge

Service bật Helmet, CORS có allow-list, CSRF defense cho request thay đổi dữ liệu và throttling lưu trong Redis. Các policy này chạy ở global guard level để mọi module có cùng nguyên tắc.

### 3.6. Notification realtime

Socket.IO xác thực token trong handshake, join user/role/permission room và nhận event từ Redis pub/sub. Khi chạy nhiều instance, mỗi instance có subscriber riêng để đẩy notification đến client đang kết nối tại instance đó.

## 4. Trust surface

<details>
<summary>Request nào được Gateway tin và request nào không?</summary>

Gateway tin các dữ liệu sau sau khi đã kiểm tra nguồn:

- JWT signature, issuer và thời hạn từ Keycloak.
- Identity và permission được Auth Service trả về cho user đã xác minh.
- Header nội bộ do chính Gateway inject sau guard pipeline.
- Response status/data từ upstream, nhưng không tự biến nó thành business truth.

Gateway không tin:

- `x-user-id`, `x-user-roles` hoặc `x-user-permissions` do browser tự gửi.
- Permission được suy ra chỉ từ một role string mà không qua Auth Service.
- Origin không nằm trong `ALLOWED_ORIGINS`.
- Request mutation thiếu `X-Requested-With: XMLHttpRequest`.
- WebSocket token truyền qua query string.

</details>

## 5. See It Work

### 5.1. Khởi động Gateway

```powershell
cd services/api-gateway
Copy-Item .env.example .env
npm install
npm run dev
```

### 5.2. Kiểm tra health

```powershell
curl http://localhost:3001/api/health
```

Health endpoint kiểm tra process và trả thông tin môi trường cơ bản. Nó không thay thế việc kiểm tra đầy đủ Keycloak, Redis và downstream service.

### 5.3. Mở API documentation

Khi chạy ở development, mở:

```text
http://localhost:3001/docs
```

Swagger có bearer authentication để thử các route cần JWT. Token phải là token hợp lệ do Keycloak cấp; không dùng token giả hoặc header identity tự tạo.

### 5.4. Thử một route qua Gateway

```powershell
curl http://localhost:3001/api/v1/products
```

Với route yêu cầu đăng nhập, request không có bearer token sẽ bị chặn tại Gateway. Khi có token:

```powershell
curl http://localhost:3001/api/v1/products `
  -H "Authorization: Bearer <keycloak-access-token>"
```

Kết quả cuối cùng phụ thuộc Product Service và dữ liệu môi trường đang chạy.

## 6. Install

> [!IMPORTANT]
> API Gateway là edge service nên cần các dependency runtime ở ngoài process: Keycloak để verify JWKS, Redis để throttle/realtime, và các downstream HTTP service tương ứng với route bạn muốn test. Gateway không sở hữu database nghiệp vụ.

### Điều cần chuẩn bị

- Node.js tương thích với workspace và npm.
- Keycloak realm `bin-ecommerce` đang phát hành access token.
- Redis đang chạy và có thể truy cập bằng `REDIS_HOST`/`REDIS_PORT`.
- Auth Service để resolve permission động.
- Downstream service cần dùng: Product, Catalog, Seller, Order, Cart, Recommendation, AI, Notification, Shipping hoặc Media.

### Tính đảo ngược

Đây là service stateless ở tầng ứng dụng. Có thể dừng process, thay biến môi trường hoặc đưa traffic về instance khác mà không cần rollback dữ liệu của Gateway. Việc rollback business data thuộc service sở hữu dữ liệu.

## 7. Getting Started

### Chạy local tối thiểu

Nếu chỉ cần kiểm tra bootstrap và health, có thể chạy Gateway cùng Redis và cấu hình `.env` tối thiểu. Nếu muốn gọi route được bảo vệ, cần thêm Keycloak và Auth Service. Nếu muốn gọi route proxy, service đích cũng phải sẵn sàng ở URL tương ứng.

```powershell
cd services/api-gateway
Copy-Item .env.example .env
npm run dev
```

### Luồng kiểm tra đề xuất

1. Gọi `/api/health` để xác nhận process đã listen.
2. Mở `/docs` để kiểm tra route metadata.
3. Gọi route public hoặc guest nếu có.
4. Đăng nhập qua Auth Service/Keycloak để lấy access token.
5. Authorize token trong Swagger hoặc gửi bearer token bằng curl.
6. Kiểm tra log và response status của downstream khi thử route nghiệp vụ.

### Build production

```powershell
npm run build
npm run start
```

Production không expose Swagger vì `main.ts` chỉ đăng ký `/docs` ngoài môi trường `production`.

## 8. How It Works

### 8.1. HTTP request flow

```text
Browser / Web App
      |
      v
API Gateway :3001
      |
      +--> ThrottlerGuard --------> Redis counter
      |
      +--> CsrfGuard ------------- > mutation request policy
      |
      +--> JwtAuthGuard ---------- > Keycloak JWKS
      |          |
      |          +----------------> Auth Service /auth/me
      |
      +--> PermissionsGuard ------> route permission metadata
      |
      +--> ProxyService ----------> downstream service
```

Global prefix `/api` được áp trước route controller; URI versioning thêm `v1` cho các route versioned. Health endpoint là `/api/health` vì controller health không nằm trong versioned group theo cách khai báo hiện tại.

### 8.2. Forwarding flow

`ProxyService.forward()` giữ method, body, query và các header nằm trong allow-list. Gateway thêm context identity sau đó gọi Axios với `validateStatus` cho phép giữ response status của upstream. Vì vậy lỗi business `4xx/5xx` của downstream không bị biến thành một lỗi thành công ở Gateway.

```text
Client request
   -> validate + enrich context
   -> Axios downstream
      -> upstream response: giữ status/data/headers
      -> network error: 503 Service Unavailable
```

Binary response như label vận chuyển dùng đường `forwardBinary()` để giữ `arraybuffer` và content headers cần thiết.

## 9. Security Pipeline

### 9.1. Thứ tự guard

Thứ tự global hiện tại là một invariant quan trọng:

| Thứ tự | Guard | Trách nhiệm |
| ---: | --- | --- |
| 1 | `ThrottlerGuard` | Giới hạn tần suất theo storage Redis |
| 2 | `CsrfGuard` | Chặn mutation không có request marker hợp lệ |
| 3 | `JwtAuthGuard` | Verify JWT, resolve context và xử lý guest |
| 4 | `PermissionsGuard` | Kiểm tra permission của route |

Thay đổi thứ tự có thể làm permission chạy trước khi identity được inject hoặc làm request bất hợp lệ đi xa hơn cần thiết.

### 9.2. JWT và JWKS

`JwksService` xây issuer từ `KEYCLOAK_URL` và `KEYCLOAK_REALM`, dùng endpoint:

```text
{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/certs
```

JWKS client bật cache public key tối đa một giờ và giới hạn 10 request mỗi phút. Token phải có issuer đúng và dùng `RS256`. Role được đọc từ claim trực tiếp, `realm_access` và `resource_access`, sau đó chuẩn hóa về business role.

### 9.3. Identity headers

Các context header thường được forward:

```text
x-user-id
x-user-email
x-user-name
x-user-avatar-url
x-user-roles
x-user-permissions
x-session-id
x-request-id
```

Downstream nên xem đây là context do trusted gateway cung cấp, không phải dữ liệu người dùng được phép sửa từ browser. Permission source vẫn là Auth Service; Gateway chỉ chuyển tiếp và áp route guard.

### 9.4. CORS, Helmet và CSRF

- Helmet bổ sung các HTTP security headers cơ bản.
- CORS lấy allow-list từ `ALLOWED_ORIGINS` và bật credentials.
- `GET`, `HEAD`, `OPTIONS` không cần CSRF marker.
- Mutation request cần `X-Requested-With: XMLHttpRequest`, trừ route có `@SkipCsrf()`.
- Route guest được đánh dấu riêng bằng `@AllowGuest()`; guest không được giữ các header identity spoofable.

## 10. Service Boundary

### Gateway sở hữu

- Public edge contract và API version prefix.
- Route aggregation cho các domain đang được expose.
- JWT verification và context propagation.
- Permission guard ở boundary.
- CORS, Helmet, CSRF, throttling và graceful shutdown.
- Health endpoint và Swagger development surface.
- Socket.IO notification namespace và Redis subscriber tại edge.

### Gateway không sở hữu

- User credential, role/permission source of truth: thuộc Keycloak/Auth Service.
- Product, cart, order, shipping, seller và recommendation data: thuộc service domain tương ứng.
- Database nghiệp vụ hoặc migration riêng.
- AI model, ranking policy và candidate pipeline.
- Business retry, transaction hoặc compensation của downstream.

Nguyên tắc này giữ controller proxy mỏng: nếu một quy tắc chỉ có ý nghĩa trong domain, đặt nó ở service domain thay vì thêm nhánh nghiệp vụ vào Gateway.

## 11. Service Communication

### 11.1. Synchronous HTTP

| Downstream | Biến cấu hình | Default local | Gateway dùng cho |
| --- | --- | ---: | --- |
| Keycloak | `KEYCLOAK_URL` | `8080` | JWKS verification |
| Auth Service | `AUTH_SERVICE_URL` | `3002` | Auth flow, users, admin access và permission lookup |
| Catalog Service | `CATALOG_SERVICE_URL` | `3003` | Categories/catalog wildcard proxy |
| Media Service | `MEDIA_SERVICE_URL` | `3004` | Media wildcard proxy |
| Notification Service | `NOTIFICATION_SERVICE_URL` | `3005` | Notification feed/actions |
| Recommendation Service | `RECOMMENDATION_SERVICE_URL` | `3006` | Events, recommendations và admin policy proxy |
| Seller Service | `SELLER_SERVICE_URL` | `3007` | Seller onboarding, shop và shipping settings |
| Product Service | `PRODUCT_SERVICE_URL` | `3008` | Product, reviews và seller product APIs |
| AI Service | `AI_SERVICE_URL` | `3009` | Seller product-content và image optimization |
| Cart Service | `CART_SERVICE_URL` | `3010` trong env mẫu | Cart APIs; cần đối chiếu port service thực tế |
| Order Service | `ORDER_SERVICE_URL` | `3011` | Customer và seller order APIs |
| Inventory Service | `INVENTORY_SERVICE_URL` | `3011` trong env mẫu | Biến cấu hình hiện có, chưa thấy module proxy tương ứng |
| Shipping Service | `SHIPPING_SERVICE_URL` | `3012` | Shipment, tracking và locations |
| Promotion Service | `PROMOTION_SERVICE_URL` | `3013` trong env mẫu | Biến cấu hình hiện có, chưa thấy module proxy tương ứng |
| Return Service | `RETURN_SERVICE_URL` | `3014` trong env mẫu | Biến cấu hình hiện có, chưa thấy module proxy tương ứng |

Gateway không tự discovery service. Mỗi proxy controller đọc URL từ `ConfigService`, vì vậy sai URL sẽ biểu hiện thành lỗi upstream/503 hoặc route trả lỗi từ service đích.

### 11.2. Async và realtime

Gateway không tự sở hữu event bus nghiệp vụ. Notification realtime dùng Redis channel `NOTIFICATION_REALTIME_CHANNEL`; subscriber nhận message, parse payload và phát tới các Socket.IO room phù hợp. Nếu Redis realtime subscription lỗi, REST notification feed vẫn là đường fallback độc lập.

## 12. Route Map

Tất cả route dưới đây được ghép với prefix bên ngoài `/api/v1`, trừ health `/api/health`. Danh sách phản ánh controller hiện tại, không phải danh sách endpoint nội bộ của từng downstream.

### Auth và account

| Method | Route |
| --- | --- |
| `POST` | `/auth/register/initiate`, `/auth/register/verify`, `/auth/login`, `/auth/refresh` |
| `POST` | `/auth/forgot-password`, `/auth/reset-password` |
| `GET/POST` | `/auth/social/start/:provider`, `/auth/social/callback/:provider` |
| `ALL` | `/users/*`, `/admin/users/*`, `/admin/access-control/*` |

### Catalog, media và shop

| Method | Route |
| --- | --- |
| `ALL` | `/categories/*`, `/media/*`, `/notifications/*` |
| `GET` | `/shops`, `/shops/:identifier` |
| `PUT/DELETE` | `/shops/:identifier/follow` |

### Product

| Method | Route family |
| --- | --- |
| `GET` | `/products`, `/products/:id`, `/products/brands` |
| `GET` | `/products/seller`, `/products/seller/:productId`, shop summary và external shop summary |
| `POST/PUT/DELETE` | Seller product create/update/delete/restore/status |
| `GET/POST/PATCH/PUT/DELETE` | Product reviews, review media cleanup và review likes |

### Cart và order

| Domain | Route family |
| --- | --- |
| Cart | `/cart`, `/cart/items`, `/cart/items/:itemId` |
| Customer order | `/orders/quote`, `/orders/shipping-address/*`, `/orders`, `/orders/:orderId`, cancel, returns và delivery confirmation |
| Seller order | `/seller/orders`, `/seller/orders/:orderId`, returns approve/reject/inspection |

### Seller, shipping và AI

| Domain | Route family |
| --- | --- |
| Seller | `/seller/applications/*`, `/seller/shop/profile/*`, `/seller/shipping/*` |
| Shipping | `/seller/orders/:orderId/shipment/*`, `/orders/:orderId/tracking`, `/shipping/locations/*` |
| AI content | `/seller/ai/product-content/name-suggestions`, `/description-suggestions` |
| AI image | `/seller/ai/image-optimization/overview`, `jobs/*`, apply/reject/rollback |

### Recommendation và admin

| Domain | Route family |
| --- | --- |
| Recommendation | `/recommendation/events`, `/recommendation/events/batch`, `/recommendation/recommendations`, `/recommendation/profile/merge` |
| Admin recommendation | `/admin/recommendation/overview`, `users/*`, `config`, `config/history`, `config/rollback/:version`, `experiments` |

## 13. Realtime Notifications

### Kết nối client

Client kết nối Socket.IO vào namespace `/notifications` và gửi token trong handshake auth:

```typescript
const socket = io("http://localhost:3001/notifications", {
  auth: { token: accessToken },
});
```

Token không nên truyền trong query string vì query dễ xuất hiện trong log, proxy trace hoặc history.

### Room và audience

Sau khi verify handshake, Gateway có thể đưa socket vào các room theo user, broadcast, role và permission. Notification publisher có thể nhắm đến user, role, permission hoặc shop audience; gateway instance hiện tại chịu trách nhiệm emit cho client đang giữ kết nối với nó.

### Failure behavior

- Handshake không có token hợp lệ sẽ bị từ chối.
- Message Redis malformed sẽ bị bỏ qua, không làm subscriber process crash.
- Redis realtime subscriber lỗi không làm mất REST notification API.
- Khi scale nhiều instance, tất cả instance phải dùng chung Redis channel và token/config tương thích.

## 14. Project Structure

```text
src/
├── app.module.ts                         # Composition root, global modules/guards
├── main.ts                               # Bootstrap, prefix, versioning, CORS, Swagger
├── common/
│   ├── adapters/                          # Socket.IO adapter
│   ├── config/                            # Helmet configuration
│   ├── decorators/                        # Public, guest, permission, CSRF metadata
│   ├── guards/                            # Throttle-adjacent security guards
│   ├── security/                          # Security module and HTTP security setup
│   └── services/                          # JWKS verification and HTTP proxy boundary
├── database/redis/                        # Redis module/configuration
└── modules/
    ├── ai/                                # AI product content/image proxy
    ├── auth/                              # Auth, users and admin access proxy
    ├── cart/                              # Cart proxy
    ├── catalog/                           # Category proxy
    ├── health/                            # Health endpoint
    ├── media/                             # Media wildcard proxy
    ├── notification/                      # Notification REST proxy
    ├── order/                             # Customer and seller order proxy
    ├── product/                           # Product/review proxy
    ├── realtime-notifications/            # Socket.IO gateway and Redis subscriber
    ├── recommendation/                    # Recommendation/admin proxy
    ├── seller/                            # Seller/shop proxy
    ├── shipping/                          # Shipment and location proxy
    └── shop/                              # Public shop/follow proxy
```

### File ownership

| File/area | Responsibility |
| --- | --- |
| `src/main.ts` | Cross-cutting HTTP runtime setup |
| `src/app.module.ts` | Module composition và global guard registration |
| `common/services/jwks.service.ts` | Keycloak key discovery và JWT verification |
| `common/services/proxy.service.ts` | Header allow-list, forward và upstream error mapping |
| `common/guards/*` | Request admission, identity và permission checks |
| `modules/*/*-proxy.controller.ts` | Route-to-service mapping, không chứa domain transaction |
| `modules/realtime-notifications/*` | Socket handshake, Redis subscription và emit |

## 15. Configuration Reference

### Runtime và browser boundary

| Variable | Ý nghĩa | Mặc định mẫu |
| --- | --- | --- |
| `NODE_ENV` | Runtime mode, ảnh hưởng Swagger | `development` |
| `PORT` | HTTP listen port | `3001` |
| `ALLOWED_ORIGINS` | Comma-separated CORS allow-list | `http://localhost:5173,http://localhost:3001` |

### Identity và security

| Variable | Ý nghĩa |
| --- | --- |
| `KEYCLOAK_URL` | Keycloak base URL |
| `KEYCLOAK_REALM` | Realm phát hành access token |
| `INTERNAL_SERVICE_TOKEN` | Secret cho các internal downstream contract khi controller yêu cầu |

### Redis

| Variable | Ý nghĩa | Mặc định mẫu |
| --- | --- | --- |
| `REDIS_HOST` | Redis hostname | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `REDIS_PASSWORD` | Redis password, có thể để trống local | — |
| `REDIS_DB` | Redis logical database | `0` |

### Downstream URLs

Các biến `*_SERVICE_URL` trong `.env.example` là runtime wiring, không phải service discovery. Khi đổi port hoặc deploy container, cập nhật URL theo network/container name của môi trường đó; không cần sửa controller.

Không commit access token, private key, internal token thật hoặc secret của Redis vào `.env.example` hay README.

## 16. Development

### Scripts

| Command | Mục đích |
| --- | --- |
| `npm run dev` | Nest watch mode |
| `npm run build` | Compile production bundle |
| `npm run start` | Chạy bundle đã build |
| `npm run lint` | ESLint cho `src` |
| `npm run type-check` | TypeScript check không emit |
| `npm test` | Jest unit/controller tests |

### Quality gate cục bộ

```powershell
npm run type-check
npm run lint
npm test -- --runInBand
npm run build
```

Nên chạy theo thứ tự trên khi thay đổi guard, proxy service hoặc controller. Khi test proxy, mock Axios/ConfigService và kiểm tra cả request headers lẫn status/data trả về; không nên biến test unit thành phụ thuộc bắt buộc vào cả cụm microservice.

### Thêm một proxy module

1. Xác định service nào sở hữu contract và biến URL tương ứng.
2. Tạo controller mỏng trong module domain.
3. Dùng `ProxyService` để forward body/query/selected headers.
4. Gắn decorator `@Public`, `@AllowGuest`, `@RequirePermissions` hoặc `@SkipCsrf` đúng contract.
5. Đăng ký module trong `AppModule`.
6. Thêm test cho route, config key và failure response.
7. Cập nhật route map, boundary và config reference trong README.

Không thêm business repository hoặc gọi database domain từ Gateway chỉ để phục vụ một route mới.

## 17. Engineering Decisions

### 17.1. Gateway kiểm tra token, Auth Service cung cấp permission

Keycloak là nguồn xác thực cryptographic; Auth Service là nơi hiểu profile, role mapping và permission động. Tách hai trách nhiệm giúp Gateway không phải giữ policy authorization trùng lặp và giúp thay đổi permission có hiệu lực mà không cần phát hành lại Gateway.

### 17.2. Forward upstream status

Proxy giữ nguyên response status/data/header để client nhận đúng contract của domain service. Gateway chỉ chuyển network failure thành `503`; nó không che lỗi `400`, `401`, `403`, `404` hoặc `5xx` do downstream trả về.

### 17.3. Header allow-list

Forward có chọn lọc giảm nguy cơ chuyển tiếp header không cần thiết. Identity header được Gateway áp sau client header để tránh spoofing. `x-request-id`, `idempotency-key` và `x-session-id` được giữ khi có để hỗ trợ trace và request semantics.

### 17.4. Redis-backed throttling

Throttle dùng Redis thay vì memory local để các instance chia sẻ counter. Đây là lựa chọn phù hợp khi Gateway scale ngang, nhưng Redis trở thành dependency cần monitor.

### 17.5. Socket.IO handshake auth

Token nằm trong `handshake.auth` thay vì query string. Gateway verify cùng boundary JWT và chỉ emit notification sau khi socket đã có identity hợp lệ.

## 18. Operational Notes

### Observability tối thiểu

Khi điều tra một request, đối chiếu:

- Gateway access/error log.
- `x-request-id` nếu client/upstream đã cung cấp.
- HTTP status và latency của downstream.
- Keycloak JWKS availability khi verify token.
- Redis health khi throttle hoặc realtime bất thường.

Gateway hiện không phải source of truth cho business audit. Audit nghiệp vụ phải được ghi ở service sở hữu mutation.

### Failure matrix

| Sự cố | Hành vi mong đợi |
| --- | --- |
| JWT không hợp lệ | Gateway từ chối trước khi forward |
| Thiếu permission | `403 Forbidden` từ permission guard |
| Origin không được allow | Browser bị CORS policy chặn |
| Mutation thiếu CSRF marker | Gateway từ chối request |
| Upstream không kết nối được | `503 Service Unavailable` |
| Upstream trả lỗi business | Giữ status/data lỗi của upstream |
| Redis throttle lỗi | Cần kiểm tra startup/runtime health vì throttler phụ thuộc Redis |
| Redis realtime subscriber lỗi | REST notification vẫn độc lập; realtime instance đó không nhận pub/sub |

### Deploy checklist

- Cập nhật toàn bộ `*_SERVICE_URL` theo network production.
- Đảm bảo `KEYCLOAK_URL` và realm khớp issuer trong token.
- Cấu hình `ALLOWED_ORIGINS` là origin thật, không dùng wildcard với credentials.
- Đặt secret internal/Redis qua secret manager.
- Kiểm tra `/api/health` và route đại diện sau deploy.
- Kiểm tra `/docs` không bị expose ngoài development.
- Xác nhận các instance dùng chung Redis khi scale Gateway.

## 19. Documentation Findings

Các điểm dưới đây được ghi nhận từ source/config hiện tại để tránh đọc README như một cam kết rằng mọi wiring đã đồng nhất:

1. `main.ts` và `.env.example` của Gateway dùng port mặc định `3001`, trong khi `infra/nginx/conf.d/default.conf` hiện trỏ upstream `api-gateway:3000`. Cần thống nhất khi deploy qua Nginx.
2. `.env.example` đang để `CART_SERVICE_URL=http://localhost:3010`, trong khi Cart Service hiện có cấu hình local mặc định khác. Cần đối chiếu compose/runtime wiring trước khi test cart qua Gateway.
3. `INVENTORY_SERVICE_URL`, `PROMOTION_SERVICE_URL` và `RETURN_SERVICE_URL` tồn tại trong env mẫu nhưng source Gateway hiện chưa đăng ký proxy module tương ứng.
4. Bảng route ở README mô tả controller đang có; wildcard `ALL` không có nghĩa Gateway tự sinh business endpoint mà chỉ forward path được downstream hỗ trợ.

Đây là ghi chú tài liệu, không tự ý sửa config hạ tầng trong phạm vi README.

## 20. FAQ

### Vì sao frontend không gọi thẳng microservice?

Để frontend chỉ phụ thuộc một edge contract, không lộ topology nội bộ và không phải tự lặp lại JWT, permission, CORS, CSRF và identity propagation.

### Gateway có lưu user hoặc order không?

Không. Gateway chỉ giữ state kỹ thuật ngắn hạn ở Redis cho throttling/realtime. User, order và các dữ liệu nghiệp vụ nằm ở service sở hữu chúng.

### Vì sao token hợp lệ nhưng vẫn nhận 403?

JWT chứng minh danh tính chưa đồng nghĩa user có permission của route. Gateway lấy permission động qua Auth Service rồi `PermissionsGuard` mới quyết định cho forward.

### Khi downstream trả 404 thì Gateway có đổi thành 503 không?

Không. `ProxyService` giữ nguyên HTTP response của upstream. `503` dành cho lỗi không kết nối được hoặc lỗi transport tại proxy boundary.

### Có thể tắt JWT cho một route không?

Chỉ route được code đánh dấu `@Public()` hoặc `@AllowGuest()` mới bypass tương ứng. Không nên tắt global guard để sửa lỗi một endpoint; hãy kiểm tra metadata và security contract của route đó.

### Có thể dùng Gateway để gọi AI Service trực tiếp từ browser không?

Browser chỉ gọi route được expose qua Gateway. Internal token hoặc URL nội bộ không được đưa vào frontend; quyền truy cập vẫn phải đi qua JWT, permission và proxy contract.

## 21. Ownership

### Engineering

**Đào Ngọc Anh**

**Software Engineer**

[View portfolio](https://daongocanh.site)

Software Engineer responsible for the architecture, implementation, integration, and maintenance of this service.

### Architecture & API Design

**Đào Ngọc Anh**

Designed the gateway boundary, security pipeline, proxy contracts, identity propagation, realtime notification edge, and integration with the Bin Ecommerce ecosystem.
