// Unit test cho boundary proxy Order của API Gateway.
// Permission guard được kiểm tra ở lớp guard; test này xác nhận URL và response được forward đúng.

import type { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import type { ProxyService } from "../../common/services/proxy.service";
import { OrderProxyController } from "./order-proxy.controller";

describe("OrderProxyController", () => {
  // Tạo HTTP context giả tối thiểu để test forwarding không cần khởi động HTTP server.
  function createHttpContext(): { request: Request; response: Response } {
    const request = {
      method: "POST",
      body: { shippingAddressId: "address-1", paymentMethod: "COD" },
      headers: { "x-user-id": "user-1", "idempotency-key": "checkout-key" },
    } as unknown as Request;
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    return { request, response };
  }

  // Forward create order tới đúng Order Service URL và giữ nguyên response status/body.
  it("should forward create order requests to Order Service", async () => {
    // Arrange
    const { request, response } = createHttpContext();
    const proxyService = {
      forward: jest.fn().mockResolvedValue({
        data: { id: "order-1", status: "CONFIRMED" },
        status: 201,
        headers: {},
      }),
    } as unknown as ProxyService;
    const config = {
      get: jest.fn().mockReturnValue("http://order-service:3004"),
    } as unknown as ConfigService;
    const target = new OrderProxyController(config, proxyService);

    // Act
    await target.proxyCreateOrder(request, response);

    // Assert
    expect(proxyService.forward).toHaveBeenCalledWith(
      "http://order-service:3004/api/v1/orders",
      request,
    );
    expect(response.status).toHaveBeenCalledWith(201);
    expect(response.json).toHaveBeenCalledWith({
      id: "order-1",
      status: "CONFIRMED",
    });
  });

  // Forward order detail tới endpoint có orderId để Order Service tự kiểm tra ownership.
  it("should forward order detail requests with the requested order id", async () => {
    // Arrange
    const { request, response } = createHttpContext();
    const proxyService = {
      forward: jest
        .fn()
        .mockResolvedValue({
          data: { id: "order-1" },
          status: 200,
          headers: {},
        }),
    } as unknown as ProxyService;
    const config = {
      get: jest.fn().mockReturnValue("http://order-service:3004"),
    } as unknown as ConfigService;
    const target = new OrderProxyController(config, proxyService);

    // Act
    await target.proxyOrderDetail("order-1", request, response);

    // Assert
    expect(proxyService.forward).toHaveBeenCalledWith(
      "http://order-service:3004/api/v1/orders/order-1",
      request,
    );
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({ id: "order-1" });
  });

  // Forward query filter và pagination để Order Service tự kiểm tra owner trong context hiện tại.
  it("should forward order list requests with query parameters", async () => {
    // Arrange
    const { request, response } = createHttpContext();
    request.method = "GET";
    request.query = { page: "2", pageSize: "10", status: "CONFIRMED" };
    const proxyService = {
      forward: jest
        .fn()
        .mockResolvedValue({ data: { items: [] }, status: 200, headers: {} }),
    } as unknown as ProxyService;
    const config = {
      get: jest.fn().mockReturnValue("http://order-service:3004"),
    } as unknown as ConfigService;
    const target = new OrderProxyController(config, proxyService);

    // Act
    await target.proxyOrderList(request, response);

    // Assert
    expect(proxyService.forward).toHaveBeenCalledWith(
      "http://order-service:3004/api/v1/orders",
      request,
    );
    expect(response.status).toHaveBeenCalledWith(200);
  });

  // Forward cancel đúng orderId và giữ nguyên response lỗi/thành công từ Order Service.
  it("should forward order cancellation requests", async () => {
    // Arrange
    const { request, response } = createHttpContext();
    request.method = "POST";
    request.body = { reason: "Đổi ý" };
    const proxyService = {
      forward: jest
        .fn()
        .mockResolvedValue({
          data: { status: "CANCELLED" },
          status: 200,
          headers: {},
        }),
    } as unknown as ProxyService;
    const config = {
      get: jest.fn().mockReturnValue("http://order-service:3004"),
    } as unknown as ConfigService;
    const target = new OrderProxyController(config, proxyService);

    // Act
    await target.proxyCancelOrder("order-1", request, response);

    // Assert
    expect(proxyService.forward).toHaveBeenCalledWith(
      "http://order-service:3004/api/v1/orders/order-1/cancel",
      request,
    );
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({ status: "CANCELLED" });
  });
});
