import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HttpModule } from "@nestjs/axios";
import { ThrottlerModule } from "@nestjs/throttler";
import { TerminusModule } from "@nestjs/terminus";
import { APP_GUARD } from "@nestjs/core";

import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { JwksService } from "./common/services/jwks.service";
import { HealthModule } from "./modules/health/health.module";
import { AuthProxyModule } from "./modules/auth/auth-proxy.module";
import { NotificationProxyModule } from "./modules/notification/notification-proxy.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env.local", ".env"],
    }),

    HttpModule.register({ timeout: 30000, maxRedirects: 0 }), // Cấu hình HttpModule với timeout 30 giây và không cho phép redirect (đảm bảo các request đến auth-service không bị redirect nếu có lỗi)

    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]), // Cấu hình rate limiting: tối đa 100 request mỗi phút cho mỗi IP

    TerminusModule,
    HealthModule,

    // Proxy modules
    AuthProxyModule,
    NotificationProxyModule,
  ],
  providers: [
    JwksService,
    {
      provide: APP_GUARD,

      useClass: JwtAuthGuard, // Sử dụng JwtAuthGuard làm global guard để bảo vệ tất cả các route theo mặc định, trừ những route được đánh dấu là @Public() sẽ được bỏ qua trong JwtAuthGuard.
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard, // Sử dụng RolesGuard làm global guard để kiểm tra role của người dùng trên tất cả các route, dựa trên metadata @Roles() được định nghĩa trong controller hoặc route handler.
    },
  ],
})
export class AppModule {}
