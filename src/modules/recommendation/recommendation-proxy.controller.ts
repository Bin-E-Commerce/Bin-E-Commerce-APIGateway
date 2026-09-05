// Controller này mở một ingestion endpoint thống nhất cho Web nhưng không sở hữu logic recommendation hay event storage.

import { Controller, Post, Req, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import { AllowGuest } from "../../common/decorators/allow-guest.decorator";
import { SkipCsrf } from "../../common/decorators/skip-csrf.decorator";
import { ProxyService } from "../../common/services/proxy.service";

@Controller("recommendation")
export class RecommendationProxyController {
  private readonly targetBase: string;

  // Đọc URL từ config để local và Docker đổi routing mà không cần sửa controller.
  constructor(
    config: ConfigService,
    private readonly proxyService: ProxyService,
  ) {
    this.targetBase = config.get<string>(
      "RECOMMENDATION_SERVICE_URL",
      // Khi chạy Gateway trực tiếp trên host, Docker DNS không tồn tại; Docker Compose sẽ override bằng service name.
      "http://localhost:3006",
    );
  }

  // Cho phép guest session và user đã đăng nhập; identity hợp lệ sẽ được JwtAuthGuard forward qua ProxyService.
  @Post("events")
  @AllowGuest()
  @SkipCsrf()
  async proxyInteractionEvent(
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const { data, status } = await this.proxyService.forward(
      `${this.targetBase}/api/v1/recommendation/events`,
      request,
    );
    response.status(status).json(data);
  }
}
