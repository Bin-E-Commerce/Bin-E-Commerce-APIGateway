import { All, Controller, Get, Post, Req, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import { Permission } from "@common/auth";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { ProxyService } from "../../common/services/proxy.service";

@Controller("seller")
export class SellerProxyController {
  private readonly targetBase: string;

  // Khởi tạo URL seller-service; controller này không @Public nên JwtAuthGuard sẽ bắt buộc đăng nhập.
  constructor(
    private readonly config: ConfigService,
    private readonly proxyService: ProxyService,
  ) {
    this.targetBase = config.get<string>(
      "SELLER_SERVICE_URL",
      "http://seller-service:3007",
    );
  }

  // Chặn danh sách hồ sơ seller ngay tại gateway bằng permission cụ thể trước khi proxy vào seller-service.
  @Get("applications/admin")
  @RequirePermissions(Permission.SELLER_APPLICATION_READ)
  async proxyAdminApplications(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.proxyToSeller(req, res);
  }

  // Bảo vệ route chi tiết hồ sơ seller bằng cùng permission đọc hồ sơ trước khi chuyển request xuống seller-service.
  @Get("applications/admin/:id")
  @RequirePermissions(Permission.SELLER_APPLICATION_READ)
  async proxyAdminApplicationDetail(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.proxyToSeller(req, res);
  }

  // Tách quyền từ chối khỏi quyền đọc để nhân sự hỗ trợ có thể xem hồ sơ nhưng không tự ý thay đổi kết quả duyệt.
  @Post("applications/admin/:id/reject")
  @RequirePermissions(Permission.SELLER_APPLICATION_REJECT)
  async proxyRejectAdminApplication(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.proxyToSeller(req, res);
  }

  // Proxy route gốc /api/v1/seller sang seller-service.
  @All()
  async proxyRoot(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.proxyToSeller(req, res);
  }

  // Proxy toàn bộ /api/v1/seller/* và giữ nguyên user context do JWT guard inject.
  @All("*splat")
  async proxy(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.proxyToSeller(req, res);
  }

  // Dùng chung logic build URL upstream để route gốc và route con không lệch prefix version.
  private async proxyToSeller(req: Request, res: Response): Promise<void> {
    const path = req.path.replace(/^\/api/, "");
    const url = `${this.targetBase}/api${path}`;
    const { data, status } = await this.proxyService.forward(url, req);
    res.status(status).json(data);
  }
}
