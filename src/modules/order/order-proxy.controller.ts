// Controller này proxy public order API tới Order Service.
// Gateway chỉ xác thực JWT, permission và forward user context; business rule checkout nằm ở Order Service.

import { Controller, Get, Param, Post, Req, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import { Permission } from "@common/auth";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { ProxyService } from "../../common/services/proxy.service";

// Định tuyến các API order mà không để client biết địa chỉ service nội bộ.
@Controller("orders")
export class OrderProxyController {
  private readonly targetBase: string;

  // Đọc Order Service URL từ environment để chạy được cả local và Docker.
  constructor(
    private readonly config: ConfigService,
    private readonly proxyService: ProxyService,
  ) {
    this.targetBase = config.get<string>("ORDER_SERVICE_URL", "http://localhost:3011");
  }

  // Chỉ user có order.create mới được yêu cầu tạo order từ active cart.
  @Post()
  @RequirePermissions(Permission.ORDER_CREATE)
  async proxyCreateOrder(@Req() request: Request, @Res() response: Response): Promise<void> {
    const { data, status } = await this.proxyService.forward(`${this.targetBase}/api/v1/orders`, request);
    response.status(status).json(data);
  }

  // Forward chi tiết order; Order Service tự lọc owner bằng x-user-id.
  @Get(":orderId")
  @RequirePermissions(Permission.ORDER_CREATE)
  async proxyOrderDetail(
    @Param("orderId") orderId: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const { data, status } = await this.proxyService.forward(`${this.targetBase}/api/v1/orders/${orderId}`, request);
    response.status(status).json(data);
  }
}
