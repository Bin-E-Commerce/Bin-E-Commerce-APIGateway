import { All, Controller, Get, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { ConfigService } from "@nestjs/config";
import { Public } from "../../common/decorators/public.decorator";
import { ProxyService } from "../../common/services/proxy.service";

// File này dùng để proxy các request liên quan đến authentication (login, register, social auth, token refresh, etc.)
// Các route này sẽ được auth-service xử lý, api-gateway chỉ đóng vai trò trung gian chuyển tiếp request và response.
// Các route liên quan đến user profile, role management, etc. sẽ được xử lý trong users-proxy.controller.ts
// hoặc admin-users-proxy.controller.ts tùy theo yêu cầu bảo mật.
@Controller("auth")
export class AuthProxyController {
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

  // ─── Public routes (no JWT required) ─────────────────────────────────────

  @Public()
  @Post("register/initiate")
  async registerInitiate(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.forward(req, res);
  }

  @Public()
  @Post("register/verify")
  async registerVerify(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.forward(req, res);
  }

  @Public()
  @Post("login")
  async login(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.forward(req, res);
  }

  @Public()
  @Post("refresh")
  async refresh(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.forward(req, res);
  }

  @Public()
  @Get("social/start/:provider")
  async socialStart(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.forward(req, res);
  }

  @Public()
  @Post("social/callback/:provider")
  async socialCallback(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.forward(req, res);
  }

  // ─── Protected routes (JWT required — e.g. logout) ───────────────────────

  @All("*splat")
  async protectedRoutes(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.forward(req, res);
  }

  private async forward(req: Request, res: Response): Promise<void> {
    const path = req.path.replace(/^\/api/, "");
    const url = `${this.targetBase}/api${path}`;
    const { data, status, headers } = await this.proxyService.forward(url, req);

    // Forward các header quan trọng từ response của auth-service về client
    const setCookie = headers["set-cookie"];
    if (setCookie) {
      res.setHeader("Set-Cookie", setCookie);
    }
    res.status(status).json(data);
  }
}
