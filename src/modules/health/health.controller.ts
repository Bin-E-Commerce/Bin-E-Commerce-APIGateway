import { Controller, Get } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Public } from "../../common/decorators/public.decorator";

@Controller("health")
export class HealthController {
  constructor(private readonly config: ConfigService) {}

  @Public()
  @Get()
  check() {
    const downstreamServices = ["AUTH_SERVICE_URL", "NOTIFICATION_SERVICE_URL"];

    // Kiểm tra cấu hình của các dịch vụ downstream và xây dựng đối tượng phản hồi
    const configuredRoutes = downstreamServices.reduce<
      Record<string, { status: "configured" | "missing"; url: string | null }>
    >((acc, key) => {
      const url = this.config.get<string>(key);
      acc[key] = {
        status: url ? "configured" : "missing",
        url: url ?? null,
      };
      return acc;
    }, {});

    const missingRoutes = Object.values(configuredRoutes).filter(
      (route) => route.status === "missing",
    ).length;

    return {
      status: missingRoutes === 0 ? "ok" : "degraded",
      service: "api-gateway",
      version: this.config.get<string>("APP_VERSION", "1.0.0"),
      environment: this.config.get<string>("NODE_ENV", "development"),
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      checks: {
        http: { status: "ok" },
        keycloak: {
          status: this.config.get<string>("KEYCLOAK_URL")
            ? "configured"
            : "missing",
          realm: this.config.get<string>("KEYCLOAK_REALM", "bin-ecommerce"),
        },
        downstreamRoutes: configuredRoutes,
        memory: this.memoryUsage(),
      },
    };
  }

  private memoryUsage() {
    const usage = process.memoryUsage();
    return {
      status: "ok",
      rssMb: Math.round(usage.rss / 1024 / 1024),
      heapUsedMb: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(usage.heapTotal / 1024 / 1024),
    };
  }
}
