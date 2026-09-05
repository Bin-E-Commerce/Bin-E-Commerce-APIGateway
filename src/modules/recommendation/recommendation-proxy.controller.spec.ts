// Test này bảo vệ route Gateway cho tracking guest/authenticated và URL Recommendation Service.

import type { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import type { ProxyService } from "../../common/services/proxy.service";
import { RecommendationProxyController } from "./recommendation-proxy.controller";

describe("RecommendationProxyController", () => {
  // Tạo HTTP context tối thiểu để test forwarding mà không cần bind port.
  function createHttpContext(): { request: Request; response: Response } {
    return {
      request: { method: "POST", body: { interactionType: "PRODUCT_VIEWED" } } as Request,
      response: {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response,
    };
  }

  // Gateway phải giữ response 202 từ Recommendation Service cho client tracking.
  it("forwards interaction events to Recommendation Service", async () => {
    // Arrange
    const { request, response } = createHttpContext();
    const proxyService = {
      forward: jest.fn().mockResolvedValue({
        data: { accepted: true, eventId: "event-1", status: "queued" },
        status: 202,
      }),
    } as unknown as ProxyService;
    const config = {
      get: jest.fn().mockReturnValue("http://localhost:3006"),
    } as unknown as ConfigService;
    const controller = new RecommendationProxyController(config, proxyService);

    // Act
    await controller.proxyInteractionEvent(request, response);

    // Assert
    expect(proxyService.forward).toHaveBeenCalledWith(
      "http://recommendation-service:3006/api/v1/recommendation/events",
      request,
    );
    expect(response.status).toHaveBeenCalledWith(202);
    expect(response.json).toHaveBeenCalledWith({
      accepted: true,
      eventId: "event-1",
      status: "queued",
    });
  });
});
