import { Controller, Get, Patch, Post, Req, Res } from "@nestjs/common";
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

  // Chỉ người có permission duyệt hồ sơ mới được chuyển command xuống seller-service.
  @Post("applications/admin/:id/approve")
  @RequirePermissions(Permission.SELLER_APPLICATION_APPROVE)
  async proxyApproveAdminApplication(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.proxyToSeller(req, res);
  }

  // Onboarding chỉ yêu cầu đăng nhập vì customer chưa có quyền Seller Center trước khi hồ sơ được duyệt.
  @Get("applications/me")
  async proxyMyApplication(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.proxyToSeller(req, res);
  }

  // Cho user đã đăng nhập lưu hồ sơ của chính mình; Seller Service lấy ownership từ user context nội bộ.
  @Patch("applications/me")
  async proxySaveMyApplication(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.proxyToSeller(req, res);
  }

  // Gửi hồ sơ lần đầu là nghiệp vụ onboarding nên không phụ thuộc permission chỉ được cấp sau khi duyệt.
  @Post("applications/submit")
  async proxySubmitApplication(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.proxyToSeller(req, res);
  }

  // Gửi lại hồ sơ bị từ chối vẫn dùng danh tính trong JWT và rule correction tại Seller Service.
  @Post("applications/resubmit")
  async proxyResubmitApplication(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.proxyToSeller(req, res);
  }

  // Bảo vệ API đọc hồ sơ shop tại gateway; seller-service vẫn kiểm tra lại ownership bằng userId trong header nội bộ.
  @Get("shop/profile")
  @RequirePermissions(Permission.SELLER_SHOP_PROFILE_READ)
  async proxyShopProfile(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.proxyToSeller(req, res);
  }

  // Quyền cập nhật được tách khỏi quyền đọc để sau này tài khoản nhân viên shop có thể chỉ xem hồ sơ.
  @Patch("shop/profile")
  @RequirePermissions(Permission.SELLER_SHOP_PROFILE_UPDATE)
  async proxyUpdateShopProfile(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.proxyToSeller(req, res);
  }

  // Chỉ các route đã khai báo rõ ở controller mới được proxy; endpoint seller mới sẽ mặc định 404 cho đến khi gắn permission.
  private async proxyToSeller(req: Request, res: Response): Promise<void> {
    const path = req.path.replace(/^\/api/, "");
    const url = `${this.targetBase}/api${path}`;
    const { data, status } = await this.proxyService.forward(url, req);
    res.status(status).json(data);
  }
}
