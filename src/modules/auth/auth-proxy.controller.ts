import { All, Controller, Get, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import { Public } from "../../common/decorators/public.decorator";
import { ProxyService } from "../../common/services/proxy.service";

// ─── Rate-limit constants (TTL in ms) ────────────────────────────────────────
const T = {
  login: { "api-gateway-global": { limit: 10, ttl: 60_000 } }, // 10 req/min  — brute-force
  registerInit: { "api-gateway-global": { limit: 5, ttl: 60_000 } }, // 5 req/min   — OTP email spam
  registerVerify: { "api-gateway-global": { limit: 10, ttl: 60_000 } }, // 10 req/min  — OTP brute-force
  refresh: { "api-gateway-global": { limit: 30, ttl: 60_000 } }, // 30 req/min  — normal usage
  social: { "api-gateway-global": { limit: 20, ttl: 60_000 } }, // 20 req/min  — OAuth flow
  forgotPassword: { "api-gateway-global": { limit: 5, ttl: 300_000 } }, // 5 req/5min  — email flooding
  resetPassword: { "api-gateway-global": { limit: 5, ttl: 300_000 } }, // 5 req/5min  — token abuse
} as const;

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
  @Throttle(T.registerInit)
  @Post("register/initiate")
  async registerInitiate(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.forward(req, res);
  }

  @Public()
  @Throttle(T.registerVerify)
  @Post("register/verify")
  async registerVerify(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.forward(req, res);
  }

  @Public()
  @Throttle(T.login)
  @Post("login")
  async login(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.forward(req, res);
  }

  @Public()
  @Throttle(T.refresh)
  @Post("refresh")
  async refresh(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.forward(req, res);
  }

  @Public()
  @Throttle(T.forgotPassword)
  @Post("forgot-password")
  async forgotPassword(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.forward(req, res);
  }

  @Public()
  @Throttle(T.resetPassword)
  @Post("reset-password")
  async resetPassword(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.forward(req, res);
  }

  @Public()
  @Throttle(T.social)
  @Get("social/start/:provider")
  async socialStart(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.forward(req, res);
  }

  @Public()
  @Throttle(T.social)
  @Post("social/callback/:provider")
  async socialCallback(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.forward(req, res);
  }

  // ─── Protected routes (JWT required — logout, change-password, etc.) ──────
  // Sử dụng global rate limit mặc định (100 req/min) cho tất cả route còn lại

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
