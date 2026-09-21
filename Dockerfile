# Giai đoạn build của API Gateway.
# Docker Compose truyền repository root làm build context vì Gateway dùng mã chung
# ở packages/common. Context chỉ quyết định file nào Docker được phép đọc; Docker
# không tự động build các service khác trong monorepo.
FROM node:20-alpine AS builder

# Giữ cùng đường dẫn với workspace root để npm resolve package-lock và workspace.
WORKDIR /app

# Copy các file mô tả dependency trước source code. Docker sẽ cache layer này,
# nên sửa TypeScript không làm cài lại hàng trăm package nếu manifest chưa đổi.
COPY package.json package-lock.json tsconfig.base.json ./

# Gateway dùng npm workspace ở services/api-gateway và import mã chung qua alias
# @common. Chỉ copy manifest/tsconfig cần cho dependency và package chung cần compile.
COPY services/api-gateway/package.json services/api-gateway/tsconfig.json ./services/api-gateway/
COPY packages/common ./packages/common

# npm ci bảo đảm dependency đúng với package-lock.json, tránh việc mỗi lần build
# lại tự chọn version khác. --workspace giới hạn dependency nghiệp vụ cho Gateway;
# --include=dev giữ Nest CLI/TypeScript để compile, còn --ignore-scripts ngăn
# lifecycle script không cần thiết chạy trong lúc tạo image.
RUN npm ci --workspace=services/api-gateway --include=dev --ignore-scripts

# Đưa source vào sau dependency để tối ưu Docker layer cache. Dockerfile không dùng
# COPY . ., vì như vậy sẽ gửi/build nhầm source của các service khác.
COPY services/api-gateway/src ./services/api-gateway/src

# Chạy đúng script của workspace Gateway. tsconfig đặt rootDir ở repository root,
# nên output nằm ở services/api-gateway/dist/services/api-gateway/src/main.js.
# packages/common cũng được TypeScript compile vào dist để runtime không cần source
# package chung hoặc ts-node.
RUN npm run build --workspace=services/api-gateway

# Build đã hoàn tất nên loại devDependency khỏi node_modules. Nhờ đó image runtime
# không mang theo Nest CLI, TypeScript và các công cụ chỉ dành cho development.
RUN npm prune --omit=dev

# Giai đoạn runtime độc lập, không chứa compiler/source/test của build stage.
# Tách stage giúp image cuối nhỏ hơn và giảm bề mặt tấn công khi deploy.
FROM node:20-alpine AS production

# Update Alpine packages so the runtime receives current security fixes.
RUN apk upgrade --no-cache

# Ép runtime production kể cả khi người chạy image không truyền NODE_ENV.
ENV NODE_ENV=production

# Tạo user riêng không có quyền root. Nếu process bị khai thác, attacker không có
# toàn quyền trên container như khi ứng dụng chạy bằng root.
# npm/npx chỉ cần ở builder để cài dependency; runtime chỉ chạy bằng node.
# Loại chúng khỏi final image để không mang theo dependency/tooling không cần thiết của npm.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
  && addgroup -g 1001 -S nodejs \
  && adduser -S nestjs -u 1001

# Runtime giữ cấu trúc dist và node_modules mà Node.js cần để resolve module.
WORKDIR /app

# Chỉ copy dependency production và artifact build đã kiểm tra ở stage trước.
# --chown giúp user nestjs đọc được file mà không cần chạy container bằng root.
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/services/api-gateway/dist ./dist

# Từ đây mọi lệnh khởi động và healthcheck đều chạy dưới user nestjs.
USER nestjs

# Đây là port trong container; port public có thể map khác ở Compose/Ingress.
EXPOSE 3000

# Healthcheck gọi endpoint có version vì main.ts bật URI versioning mặc định v1.
# Chỉ kiểm tra HTTP process còn phục vụ; không biến lỗi downstream thành restart
# dây chuyền. Readiness/dependency check chuyên sâu nên do monitoring đảm nhiệm.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/v1/health || exit 1

# Dùng node trực tiếp thay vì npm để SIGTERM được chuyển đúng tới NestJS trong
# Compose/Kubernetes rolling update. Giới hạn heap phù hợp demo máy ít RAM và chừa
# phần memory còn lại cho native module, socket và hệ điều hành container.
CMD ["node", "--max-old-space-size=100", "dist/services/api-gateway/src/main.js"]
