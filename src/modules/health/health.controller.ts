import { Controller, Get } from "@nestjs/common";
import { HealthCheck, HealthCheckService } from "@nestjs/terminus";
import { Public } from "../../common/decorators/public.decorator";

// Xác định sức khỏe của API Gateway bằng cách sử dụng TerminusModule
// Cung cấp endpoint /api/health để các hệ thống giám sát có thể kiểm tra trạng thái của API Gateway.
@Controller("health")
export class HealthController {
  constructor(private readonly healthCheckService: HealthCheckService) {}

  @Public()
  @Get()
  @HealthCheck()
  check() {
    return this.healthCheckService.check([]);
  }
}
