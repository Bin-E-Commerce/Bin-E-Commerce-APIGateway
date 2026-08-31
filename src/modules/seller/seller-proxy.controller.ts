import { Controller, Delete, Get, Patch, Post, Req, Res } from "@nestjs/common";
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

  // Cho seller gửi thay đổi compliance của chính shop; Seller Service tự suy ownership từ x-user-id.
  @Post("shop/profile/change-requests")
  @RequirePermissions(Permission.SELLER_SHOP_PROFILE_CHANGE_REQUEST_CREATE)
  async proxyCreateShopProfileChangeRequest(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.proxyToSeller(req, res);
  }

  // Quyền đọc hàng đợi thay đổi hồ sơ độc lập với quyền duyệt hoặc từ chối.
  @Get("shop/profile/change-requests/admin")
  @RequirePermissions(Permission.ADMIN_SHOP_PROFILE_CHANGE_REQUEST_READ)
  async proxyAdminShopProfileChangeRequests(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.proxyToSeller(req, res);
  }

  // Trả snapshot trước/sau để admin đối chiếu mà không mở quyền chỉnh sửa.
  @Get("shop/profile/change-requests/admin/:requestId")
  @RequirePermissions(Permission.ADMIN_SHOP_PROFILE_CHANGE_REQUEST_READ)
  async proxyAdminShopProfileChangeRequestDetail(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.proxyToSeller(req, res);
  }

  // Chỉ role có quyền approve mới được áp dụng dữ liệu nhạy cảm vào hồ sơ hiện hành.
  @Post("shop/profile/change-requests/admin/:requestId/approve")
  @RequirePermissions(Permission.ADMIN_SHOP_PROFILE_CHANGE_REQUEST_APPROVE)
  async proxyApproveShopProfileChangeRequest(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.proxyToSeller(req, res);
  }

  // Từ chối dùng permission riêng để audit phân biệt người xem và người ra quyết định.
  @Post("shop/profile/change-requests/admin/:requestId/reject")
  @RequirePermissions(Permission.ADMIN_SHOP_PROFILE_CHANGE_REQUEST_REJECT)
  async proxyRejectShopProfileChangeRequest(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.proxyToSeller(req, res);
  }

  // Seller chỉ đọc cấu hình giao nhận của shop đã resolve từ JWT.
  @Get("shipping/settings")
  @RequirePermissions(Permission.SELLER_SHIPPING_SETTINGS_READ)
  async proxyShippingSettings(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.proxyToSeller(req, res);
  }

  // Seller cập nhật khung giờ và địa chỉ mặc định trong phạm vi shop của mình.
  @Patch("shipping/settings")
  @RequirePermissions(Permission.SELLER_SHIPPING_SETTINGS_MANAGE)
  async proxyUpdateShippingSettings(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.proxyToSeller(req, res);
  }

  // Tạo pickup address mới, backend tự gắn shop theo user context.
  @Post("shipping/pickup-addresses")
  @RequirePermissions(Permission.SELLER_SHIPPING_SETTINGS_MANAGE)
  async proxyCreatePickupAddress(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.proxyToSeller(req, res);
  }

  // Chọn địa chỉ mặc định mà không nhận shopId từ frontend.
  @Post("shipping/pickup-addresses/:id/default")
  @RequirePermissions(Permission.SELLER_SHIPPING_SETTINGS_MANAGE)
  async proxySetDefaultPickupAddress(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.proxyToSeller(req, res);
  }

  // Cập nhật pickup address trong phạm vi shop hiện tại; seller không truyền shopId để thay đổi scope.
  @Patch("shipping/pickup-addresses/:id")
  @RequirePermissions(Permission.SELLER_SHIPPING_SETTINGS_MANAGE)
  async proxyUpdatePickupAddress(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.proxyToSeller(req, res);
  }

  // Xóa pickup address theo ownership do Seller Service kiểm tra lại, không xóa nhầm địa chỉ shop khác.
  @Delete("shipping/pickup-addresses/:id")
  @RequirePermissions(Permission.SELLER_SHIPPING_SETTINGS_MANAGE)
  async proxyDeletePickupAddress(@Req() req: Request, @Res() res: Response): Promise<void> {
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
