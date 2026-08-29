// Controller này chuyển tiếp API cart công khai cho Guest và Customer tới Cart Service.
// Gateway giữ responsibility về auth context, còn Cart Service quyết định tạo hoặc đọc cart.

import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from "@nestjs/common";
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

  // Route thêm item bắt buộc có JWT và cart.item.add; Gateway chỉ forward body cùng user context đã xác thực.
  @Post("items")
  @RequirePermissions(Permission.CART_ITEM_ADD)
  async proxyAddCartItem(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const url = `${this.targetBase}/api/v1/cart/items`;
    const { data, status } = await this.proxyService.forward(url, req);
    res.status(status).json(data);
  }

  // Route cập nhật quantity chỉ forward request; Cart Service giữ business rule và kiểm tra ownership.
  @Patch("items/:itemId")
  @RequirePermissions(Permission.CART_ITEM_UPDATE)
  async proxyUpdateCartItem(
    @Param("itemId") itemId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const url = `${this.targetBase}/api/v1/cart/items/${itemId}`;
    const { data, status } = await this.proxyService.forward(url, req);
    res.status(status).json(data);
  }

  // Route xóa item dùng permission riêng để admin có thể kiểm soát độc lập với thao tác thêm/cập nhật.
  @Delete("items/:itemId")
  @RequirePermissions(Permission.CART_ITEM_REMOVE)
  async proxyRemoveCartItem(
    @Param("itemId") itemId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const url = `${this.targetBase}/api/v1/cart/items/${itemId}`;
    const { data, status } = await this.proxyService.forward(url, req);
    res.status(status).json(data);
  }
}
