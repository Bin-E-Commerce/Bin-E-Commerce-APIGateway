// Unit test boundary proxy Seller order của Gateway, tập trung xác nhận URL và response được forward đúng.

import type { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import type { ProxyService } from "../../common/services/proxy.service";
import { SellerOrderProxyController } from "./seller-order-proxy.controller";

describe("SellerOrderProxyController", () => {
  // Tạo HTTP context tối thiểu để test proxy không cần khởi động server thật.
  function createHttpContext(): { request: Request; response: Response } {
    const request = {
      method: "GET",
      headers: { "x-user-id": "seller-1", "x-user-permissions": "seller.order.read" },
      query: { page: "2", pageSize: "10", status: "CONFIRMED", search: "BIN-" },
    } as unknown as Request;
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    return { request, response };
  }

  // Gateway phải chuyển tiếp list Seller tới đúng namespace seller/orders và giữ status/body upstream.
  it("should forward seller order list requests", async () => {
    const { request, response } = createHttpContext();
    const proxyService = {
      forward: jest.fn().mockResolvedValue({
        data: { items: [], total: 0 },
        status: 200,
        headers: {},
      }),
    } as unknown as ProxyService;
    const config = {
      get: jest.fn().mockReturnValue("http://order-service:3011"),
    } as unknown as ConfigService;
    const target = new SellerOrderProxyController(config, proxyService);

    await target.proxySellerOrderList(request, response);

    expect(proxyService.forward).toHaveBeenCalledWith(
      "http://order-service:3011/api/v1/seller/orders",
      request,
    );
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({ items: [], total: 0 });
  });

  // Detail route phải forward orderId mà không thêm shopId từ request của trình duyệt.
  it("should forward seller order detail requests", async () => {
    const { request, response } = createHttpContext();
    const proxyService = {
      forward: jest.fn().mockResolvedValue({
        data: { id: "order-1" },
        status: 200,
        headers: {},
      }),
    } as unknown as ProxyService;
    const config = {
      get: jest.fn().mockReturnValue("http://order-service:3011"),
    } as unknown as ConfigService;
    const target = new SellerOrderProxyController(config, proxyService);

    await target.proxySellerOrderDetail("order-1", request, response);

    expect(proxyService.forward).toHaveBeenCalledWith(
      "http://order-service:3011/api/v1/seller/orders/order-1",
      request,
    );
    expect(response.status).toHaveBeenCalledWith(200);
  });
});
