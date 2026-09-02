// Gateway proxy cho shipment Seller; JWT permission và shop scope được giữ ở backend.

import { Controller, Get, Param, Post, Req, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import { Permission } from "@common/auth";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { ProxyService } from "../../common/services/proxy.service";

@Controller("seller/orders")
export class SellerShippingProxyController {
  private readonly targetBase: string;

  // Đọc Shipping Service URL tập trung cho local và Docker.
  constructor(config: ConfigService, private readonly proxyService: ProxyService) {
    this.targetBase = config.get<string>("SHIPPING_SERVICE_URL", "http://localhost:3012");
  }

  // Seller chỉ đọc shipment của shop hiện tại.
  @Get(":orderId/shipment")
  @RequirePermissions(Permission.SELLER_SHIPPING_READ)
  async get(@Param("orderId") orderId: string, @Req() request: Request, @Res() response: Response): Promise<void> {
    await this.forward(`/api/v1/seller/orders/${orderId}/shipment`, request, response);
  }

  // Tạo vận đơn GHN Test cho shop hiện tại.
  @Post(":orderId/shipment")
  @RequirePermissions(Permission.SELLER_SHIPPING_MANAGE)
  async create(@Param("orderId") orderId: string, @Req() request: Request, @Res() response: Response): Promise<void> {
    await this.forward(`/api/v1/seller/orders/${orderId}/shipment`, request, response);
  }

  // Tạo vận đơn chiều ngược cho một return request đã được duyệt.
  @Post("returns/:returnId/shipment")
  @RequirePermissions(Permission.SELLER_SHIPPING_MANAGE)
  async createReturn(@Param("returnId") returnId: string, @Req() request: Request, @Res() response: Response): Promise<void> {
    await this.forward(`/api/v1/seller/orders/returns/${returnId}/shipment`, request, response);
  }

  // Làm mới tracking từ provider, không tự chuyển trạng thái ở browser.
  @Post(":orderId/shipment/refresh")
  @RequirePermissions(Permission.SELLER_SHIPPING_READ)
  async refresh(@Param("orderId") orderId: string, @Req() request: Request, @Res() response: Response): Promise<void> {
    await this.forward(`/api/v1/seller/orders/${orderId}/shipment/refresh`, request, response);
  }

  // Hủy vận đơn chỉ khi GHN chưa lấy hàng.
  @Post(":orderId/shipment/cancel")
  @RequirePermissions(Permission.SELLER_SHIPPING_MANAGE)
  async cancel(@Param("orderId") orderId: string, @Req() request: Request, @Res() response: Response): Promise<void> {
    await this.forward(`/api/v1/seller/orders/${orderId}/shipment/cancel`, request, response);
  }

  // Forward thao tác bỏ qua một chặng demo với quyền quản lý vận đơn của Seller.
  @Post(":orderId/shipment/demo/advance")
  @RequirePermissions(Permission.SELLER_SHIPPING_MANAGE)
  async advanceDemo(@Param("orderId") orderId: string, @Req() request: Request, @Res() response: Response): Promise<void> {
    await this.forward(`/api/v1/seller/orders/${orderId}/shipment/demo/advance`, request, response);
  }

  // Forward nhãn nguyên dạng để browser tải file.
  @Get(":orderId/shipment/label")
  @RequirePermissions(Permission.SELLER_SHIPPING_READ)
  async label(@Param("orderId") orderId: string, @Req() request: Request, @Res() response: Response): Promise<void> {
    const result = await this.proxyService.forwardBinary(`${this.targetBase}/api/v1/seller/orders/${orderId}/shipment/label`, request);
    response.status(result.status);
    const contentType = result.headers["content-type"];
    const disposition = result.headers["content-disposition"];
    if (contentType) response.setHeader("content-type", Array.isArray(contentType) ? contentType.join(", ") : contentType);
    if (disposition) response.setHeader("content-disposition", Array.isArray(disposition) ? disposition.join(", ") : disposition);
    response.send(result.data);
  }

  // Forward JSON response và status từ Shipping Service.
  private async forward(path: string, request: Request, response: Response): Promise<void> {
    const result = await this.proxyService.forward(`${this.targetBase}${path}`, request);
    response.status(result.status).json(result.data);
  }
}
