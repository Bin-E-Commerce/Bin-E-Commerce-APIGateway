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
    this.targetBase = config.get<string>(
      "ORDER_SERVICE_URL",
      "http://localhost:3011",
    );
  }

  // Chỉ user có order.create mới được yêu cầu tạo order từ active cart.
  @Post("quote")
  @RequirePermissions(Permission.ORDER_CREATE)
  async proxyOrderQuote(@Req() request: Request, @Res() response: Response): Promise<void> {
    const { data, status } = await this.proxyService.forward(`${this.targetBase}/api/v1/orders/quote`, request);
    response.status(status).json(data);
  }

  // Đối chiếu địa chỉ checkout với bộ mã GHN trước khi gọi quote.
  @Post("shipping-address/resolve")
  @RequirePermissions(Permission.ORDER_CREATE)
  async proxyShippingAddressResolve(@Req() request: Request, @Res() response: Response): Promise<void> {
    const { data, status } = await this.proxyService.forward(`${this.targetBase}/api/v1/orders/shipping-address/resolve`, request);
    response.status(status).json(data);
  }

  // Lấy danh sách phường/xã GHN theo quận/huyện mà người mua đã chọn.
  @Post("shipping-address/ghn-wards")
  @RequirePermissions(Permission.ORDER_CREATE)
  async proxyShippingAddressWards(@Req() request: Request, @Res() response: Response): Promise<void> {
    const { data, status } = await this.proxyService.forward(`${this.targetBase}/api/v1/orders/shipping-address/ghn-wards`, request);
    response.status(status).json(data);
  }

  @Post()
  @RequirePermissions(Permission.ORDER_CREATE)
  async proxyCreateOrder(
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const { data, status } = await this.proxyService.forward(
      `${this.targetBase}/api/v1/orders`,
      request,
    );
    response.status(status).json(data);
  }

  // Forward quyết định nhận hàng sau khi Gateway đã xác thực JWT và permission customer tương ứng.
  @Post(":orderId/delivery-confirmation")
  @RequirePermissions(Permission.ORDER_CONFIRM_DELIVERY)
  async proxyDeliveryConfirmation(
    @Param("orderId") orderId: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const { data, status } = await this.proxyService.forward(
      `${this.targetBase}/api/v1/orders/${orderId}/delivery-confirmation`,
      request,
    );
    response.status(status).json(data);
  }

  // Customer tạo return request cho order của chính mình; Order Service kiểm tra điều kiện 7 ngày.
  @Post(":orderId/returns")
  @RequirePermissions(Permission.RETURN_CREATE)
  async proxyCreateReturn(@Param("orderId") orderId: string, @Req() request: Request, @Res() response: Response): Promise<void> {
    const { data, status } = await this.proxyService.forward(`${this.targetBase}/api/v1/orders/${orderId}/returns`, request);
    response.status(status).json(data);
  }

  // Customer đọc return history thuộc order hiện tại.
  @Get(":orderId/returns")
  @RequirePermissions(Permission.RETURN_READ)
  async proxyListReturns(@Param("orderId") orderId: string, @Req() request: Request, @Res() response: Response): Promise<void> {
    const { data, status } = await this.proxyService.forward(`${this.targetBase}/api/v1/orders/${orderId}/returns`, request);
    response.status(status).json(data);
  }

  // Customer đọc detail return độc lập với detail order.
  @Get("returns/:returnId")
  @RequirePermissions(Permission.RETURN_READ)
  async proxyReturnDetail(@Param("returnId") returnId: string, @Req() request: Request, @Res() response: Response): Promise<void> {
    const { data, status } = await this.proxyService.forward(`${this.targetBase}/api/v1/orders/returns/${returnId}`, request);
    response.status(status).json(data);
  }

  // Customer hủy return request khi seller chưa xử lý.
  @Post("returns/:returnId/cancellation")
  @RequirePermissions(Permission.RETURN_CANCEL)
  async proxyCancelReturn(@Param("returnId") returnId: string, @Req() request: Request, @Res() response: Response): Promise<void> {
    const { data, status } = await this.proxyService.forward(`${this.targetBase}/api/v1/orders/returns/${returnId}/cancellation`, request);
    response.status(status).json(data);
  }

  // Forward lịch sử order kèm query filter và phân trang; ownership được kiểm tra lại ở Order Service.
  @Get()
  @RequirePermissions(Permission.ORDER_READ)
  async proxyOrderList(
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const { data, status } = await this.proxyService.forward(
      `${this.targetBase}/api/v1/orders`,
      request,
    );
    response.status(status).json(data);
  }

  // Forward chi tiết order; Order Service tự lọc owner bằng x-user-id.
  @Get(":orderId")
  @RequirePermissions(Permission.ORDER_READ)
  async proxyOrderDetail(
    @Param("orderId") orderId: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const { data, status } = await this.proxyService.forward(
      `${this.targetBase}/api/v1/orders/${orderId}`,
      request,
    );
    response.status(status).json(data);
  }

  // Forward yêu cầu hủy order tới service sở hữu transaction và reservation inventory.
  @Post(":orderId/cancel")
  @RequirePermissions(Permission.ORDER_CANCEL)
  async proxyCancelOrder(
    @Param("orderId") orderId: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const { data, status } = await this.proxyService.forward(
      `${this.targetBase}/api/v1/orders/${orderId}/cancel`,
      request,
    );
    response.status(status).json(data);
  }
}
