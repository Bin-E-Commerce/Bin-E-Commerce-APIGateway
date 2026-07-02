import { All, Controller, Req, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Permission } from "@common/auth";
import type { Request, Response } from "express";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { ProxyService } from "../../common/services/proxy.service";

// Proxy khu vực cấu hình phân quyền sang auth-service.
// Chỉ tài khoản có admin.access mới được xem dữ liệu role-permission.
@Controller("admin/access-control")
@RequirePermissions(Permission.ADMIN_ACCESS)
export class AdminAccessControlProxyController {
  private readonly targetBase: string;

  constructor(
    private readonly config: ConfigService,
    private readonly proxyService: ProxyService,
  ) {
    this.targetBase = config.get<string>(
      "AUTH_SERVICE_URL",
      "http://auth-service:3002",
    );
  }

  // Đổi route công khai của Admin Center sang route nội bộ của auth-service.
  // Gateway vẫn là nơi kiểm tra quyền trước, auth-service chỉ nhận request đã có user context.
  @All("*splat")
  async proxy(@Req() req: Request, @Res() res: Response): Promise<void> {
    const path = req.path.replace(
      /^\/api\/v1\/admin\/access-control/,
      "/api/v1/auth/access-control",
    );
    const url = `${this.targetBase}${path}`;
    const { data, status } = await this.proxyService.forward(url, req);
    res.status(status).json(data);
  }
}
