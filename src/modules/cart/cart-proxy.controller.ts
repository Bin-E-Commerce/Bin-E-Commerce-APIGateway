// Controller này chuyển tiếp API cart công khai cho Guest và Customer tới Cart Service.
// Gateway giữ responsibility về auth context, còn Cart Service quyết định tạo hoặc đọc cart.

import { Controller, Get, Req, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import { Permission } from "@common/auth";
import { AllowGuest } from "../../common/decorators/allow-guest.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { ProxyService } from "../../common/services/proxy.service";

// Route /cart dùng chung cho guest session và user đã đăng nhập.
@Controller("cart")
export class CartProxyController {
  private readonly targetBase: string;

  // Đọc URL Cart Service từ config để local, Docker và production dùng cùng một controller.
  constructor(
    private readonly config: ConfigService,
    private readonly proxyService: ProxyService,
  ) {
    this.targetBase = config.get<string>(
      "CART_SERVICE_URL",
      "http://cart-service:3003",
    );
  }

  // Route vừa cho phép Guest vừa bảo vệ Customer đã đăng nhập bằng cart.read.
  @Get()
  @AllowGuest()
  @RequirePermissions(Permission.CART_READ)
  async proxyActiveCart(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const url = `${this.targetBase}/api/v1/cart`;
    const { data, status } = await this.proxyService.forward(url, req);
    res.status(status).json(data);
  }
}
