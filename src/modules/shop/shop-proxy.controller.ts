// Controller proxy các route public và follow shop về Seller Service.
// Gateway chỉ xử lý quyền truy cập và chuyển tiếp request, không sở hữu nghiệp vụ shop.
import { Controller, Delete, Get, Put, Req, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import { Permission } from "@common/auth";
import { AllowGuest } from "../../common/decorators/allow-guest.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { ProxyService } from "../../common/services/proxy.service";

// Proxy giữ Gateway là điểm vào duy nhất và chuyển toàn bộ nghiệp vụ shop về Seller Service.
@Controller("shops")
export class ShopProxyController {
  private readonly targetBase: string;

  // Đọc URL Seller Service một lần để local/Docker/production dùng cùng proxy contract.
  constructor(config: ConfigService, private readonly proxyService: ProxyService) {
    this.targetBase = config.get<string>("SELLER_SERVICE_URL", "http://seller-service:3007");
  }

  // Trang shop là dữ liệu public nhưng AllowGuest vẫn cho phép gửi identity nếu user đã đăng nhập.
  @Get(":identifier")
  @AllowGuest()
  async proxyPublicShop(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.proxyToSeller(req, res);
  }

  // Follow cần permission riêng để không dùng nhầm permission đọc shop Seller Center.
  @Put(":identifier/follow")
  @RequirePermissions(Permission.SHOP_FOLLOW)
  async proxyFollowShop(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.proxyToSeller(req, res);
  }

  // Bỏ follow dùng cùng permission và giữ semantics idempotent ở Seller Service.
  @Delete(":identifier/follow")
  @RequirePermissions(Permission.SHOP_FOLLOW)
  async proxyUnfollowShop(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.proxyToSeller(req, res);
  }

  // Giữ nguyên path/query/header identity khi chuyển request qua Seller Service.
  private async proxyToSeller(req: Request, res: Response): Promise<void> {
    const path = req.path.replace(/^\/api/, "");
    const { data, status } = await this.proxyService.forward(`${this.targetBase}/api${path}`, req);
    res.status(status).json(data);
  }
}
