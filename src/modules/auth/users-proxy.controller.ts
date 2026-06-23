import { All, Controller, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { ConfigService } from "@nestjs/config";
import { ProxyService } from "../../common/services/proxy.service";

// File này dùng để proxy các request liên quan đến user profile, role management, etc. (tức là những thứ không phải authentication flow)
// Các route này sẽ được auth-service xử lý, api-gateway chỉ đóng vai trò trung gian chuyển tiếp request và response.
// Các route liên quan đến authentication (login, register, social auth, token refresh, etc.) sẽ được xử lý trong auth-proxy.controller.ts
@Controller("users")
export class UsersProxyController {
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

  // ─── Protected routes (JWT required) ─────────────────────────────────────
  @All("*splat")
  async proxy(@Req() req: Request, @Res() res: Response): Promise<void> {
    const path = req.path.replace(/^\/api/, "");
    const url = `${this.targetBase}/api${path}`;
    const { data, status } = await this.proxyService.forward(url, req);
    res.status(status).json(data);
  }
}
