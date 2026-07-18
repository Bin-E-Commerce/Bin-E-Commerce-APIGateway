import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { ThrottlerStorageRedisService } from "@nest-lab/throttler-storage-redis";
import { TerminusModule } from "@nestjs/terminus";
import { APP_GUARD } from "@nestjs/core";
import Redis from "ioredis";
import { RedisModule, REDIS_CLIENT } from "./database/redis/redis.module";

import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { PermissionsGuard } from "./common/guards/permissions.guard";
import { CsrfGuard } from "./common/guards/csrf.guard";
import { SecurityModule } from "./common/security/security.module";
import { HealthModule } from "./modules/health/health.module";
import { AuthProxyModule } from "./modules/auth/auth-proxy.module";
import { CatalogProxyModule } from "./modules/catalog/catalog-proxy.module";
import { LocationProxyModule } from "./modules/location/location-proxy.module";
import { NotificationProxyModule } from "./modules/notification/notification-proxy.module";
import { MediaProxyModule } from "./modules/media/media-proxy.module";
import { SellerProxyModule } from "./modules/seller/seller-proxy.module";
import { ProductProxyModule } from "./modules/product/product-proxy.module";
import { RealtimeNotificationsModule } from "./modules/realtime-notifications/realtime-notifications.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env.local", ".env"],
    }),

    SecurityModule,

    // Phải khai báo trước ThrottlerModule để REDIS_CLIENT sẵn sàng inject
    RedisModule,

    // Rate limiting: Redis-backed — giữ nguyên counter khi restart, đúng khi multi-instance
    ThrottlerModule.forRootAsync({
      inject: [REDIS_CLIENT],
      useFactory: (redis: Redis) => ({
        throttlers: [
          {
            name: "api-gateway-global", // Key Redis: throttler:{ip}:api-gateway-global:hits
            ttl: 60000, // Cửa sổ 60 giây
            limit: 100, // Tối đa 100 request/phút/IP
          },
        ],
        storage: new ThrottlerStorageRedisService(redis),
      }),
    }),

    TerminusModule,
    HealthModule,

    // Proxy modules
    AuthProxyModule,
    CatalogProxyModule,
    LocationProxyModule,
    MediaProxyModule,
    SellerProxyModule,
    ProductProxyModule,
    NotificationProxyModule,
    RealtimeNotificationsModule,
  ],
  providers: [
    {
      // ThrottlerGuard phải đứng ĐẦU TIÊN — chặn request vượt limit trước khi xử lý JWT
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      // CsrfGuard đứng sau Throttler, trước JWT — từ chối sớm request thiếu CSRF header
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule {}
