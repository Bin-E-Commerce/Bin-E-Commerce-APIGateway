import { All, Controller, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { ConfigService } from "@nestjs/config";
import { Roles } from "../../common/decorators/roles.decorator";
import { ProxyService } from "../../common/services/proxy.service";
import { UserRole } from "@common/enums/user-role.enum";

// File này dùng để proxy các request liên quan đến quản lý người dùng (CRUD, role assignment, etc.)
// Mà chỉ SUPPORT_AGENT mới được phép truy cập.
// Các route này sẽ được auth-service xử lý, api-gateway chỉ đóng vai trò trung gian chuyển tiếp request và response.

@Controller("admin/users")
@Roles(UserRole.SUPPORT_AGENT)
export class AdminUsersProxyController {
  private readonly targetBase: string;

  constructor(
    private readonly config: ConfigService,
    private readonly proxyService: ProxyService,
  ) {
    this.targetBase = config.get<string>(
      "AUTH_SERVICE_URL",
      "http://auth-service:3001",
    );
  }

  // Proxy tất cả các request đến /api/v1/admin/users/* đến auth-service
  @All("*splat")
  async proxy(@Req() req: Request, @Res() res: Response): Promise<void> {
    const path = req.path.replace(/^\/api/, "");
    const url = `${this.targetBase}/api${path}`;
    const { data, status } = await this.proxyService.forward(url, req);
    res.status(status).json(data);
  }
}
