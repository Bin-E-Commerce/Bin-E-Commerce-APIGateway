import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

// Token để inject Redis client vào các service/module khác (ThrottlerModule)
export const REDIS_CLIENT = "REDIS_CLIENT";

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis => {
        return new Redis({
          host: config.get<string>("REDIS_HOST", "localhost"),
          port: config.get<number>("REDIS_PORT", 6379),
          password: config.get<string>("REDIS_PASSWORD") || undefined,
          db: config.get<number>("REDIS_DB", 0),
          lazyConnect: true,
          maxRetriesPerRequest: 3,
        });
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
