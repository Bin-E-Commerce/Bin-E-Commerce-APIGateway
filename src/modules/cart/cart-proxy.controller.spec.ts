// Test này bảo vệ boundary proxy của Cart API: route POST phải forward đúng URL, body và response status.
// Permission guard được test ở lớp guard riêng; controller unit test chỉ tập trung vào forwarding contract.

import type { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import type { ProxyService } from "../../common/services/proxy.service";
import { CartProxyController } from "./cart-proxy.controller";

// Nhóm test cho controller proxy cart của API Gateway.
describe("CartProxyController", () => {
  // Tạo request/response giả tối thiểu để test không cần HTTP server thật.
  function createHttpContext(): {
    request: Request;
    response: Response;
  } {
    const request = {
      method: "POST",
      body: {
        productId: "product-1",
        variantId: "variant-1",
        quantity: 2,
      },
      headers: { "x-user-id": "user-1" },
    } as unknown as Request;
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    return { request, response };
  }

  // POST /cart/items phải giữ nguyên payload và chuyển response từ Cart Service về client.
  it("forwards add-item requests to Cart Service", async () => {
    // Arrange
    const { request, response } = createHttpContext();
    const proxyService = {
      forward: jest.fn().mockResolvedValue({
        data: { id: "cart-1", totalItems: 2 },
        status: 200,
        headers: {},
      }),
    } as unknown as ProxyService;
    const config = {
      get: jest.fn().mockReturnValue("http://cart-service:3003"),
    } as unknown as ConfigService;
    const target = new CartProxyController(config, proxyService);

    // Act
    await target.proxyAddCartItem(request, response);

    // Assert
    expect(proxyService.forward).toHaveBeenCalledWith(
      "http://cart-service:3003/api/v1/cart/items",
      request,
    );
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      id: "cart-1",
      totalItems: 2,
    });
  });
});
