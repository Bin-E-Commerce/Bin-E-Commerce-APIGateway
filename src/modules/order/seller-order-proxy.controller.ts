// Controller này proxy Seller order API và giữ permission check ở Gateway trước khi request vào Order Service.
// Gateway không nhận shopId; ProxyService chỉ forward user context do JWT guard đã inject.

import { Controller, Get, Param, Req, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import { Permission } from "@common/auth";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { ProxyService } from "../../common/services/proxy.service";

@Controller("seller/orders")
export class SellerOrderProxyController {
  private readonly targetBase: string;

  // Đọc URL Order Service từ environment để Seller API không phụ thuộc địa chỉ service nội bộ.
  constructor(
    config: ConfigService,
    private readonly proxyService: ProxyService,
  ) {
    this.targetBase = config.get<string>(
      "ORDER_SERVICE_URL",
      "http://localhost:3011",
    );
  }

  // Chỉ Seller có permission shop-scoped mới được xem danh sách order của shop.
  @Get()
  @RequirePermissions(Permission.SELLER_ORDER_READ)
  async proxySellerOrderList(
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const { data, status } = await this.proxyService.forward(
      `${this.targetBase}/api/v1/seller/orders`,
      request,
    );
    response.status(status).json(data);
  }

  // Forward detail theo orderId; Order Service kiểm tra lại item thuộc shop hiện tại.
  @Get(":orderId")
  @RequirePermissions(Permission.SELLER_ORDER_READ)
  async proxySellerOrderDetail(
    @Param("orderId") orderId: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const { data, status } = await this.proxyService.forward(
      `${this.targetBase}/api/v1/seller/orders/${orderId}`,
      request,
    );
    response.status(status).json(data);
  }
}
