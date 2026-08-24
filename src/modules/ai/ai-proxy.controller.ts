// File này là HTTP boundary của các tính năng AI đi qua API Gateway.
// Controller chỉ xác thực permission, chuyển tiếp user context và giữ API key nằm ngoài trình duyệt.
// Logic prompt, provider và safety validation thuộc về ai-service, không đặt trong Gateway.

import { Controller, Post, Req, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import { Permission } from "@common/auth";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { ProxyService } from "../../common/services/proxy.service";

@Controller("seller/ai/product-content")
export class AiProxyController {
  private readonly targetBase: string;

  // Đọc URL ai-service từ config để local, Docker và production thay đổi routing mà không sửa code.
  // Gateway không khởi tạo OpenAI client và không bao giờ nhận API key của provider.
  constructor(
    private readonly config: ConfigService,
    private readonly proxyService: ProxyService,
  ) {
    this.targetBase = config.get<string>(
      "AI_SERVICE_URL",
      "http://ai-service:3009",
    );
  }

  // Kiểm tra permission tại Gateway trước khi gọi AI có tính phí, sau đó forward header context đã được JwtAuthGuard inject.
  // AI service kiểm tra lại permission lần hai để bảo vệ khi request không đi qua Gateway ngoài dự kiến.
  @Post("name-suggestions")
  @RequirePermissions(Permission.SELLER_AI_PRODUCT_CONTENT_GENERATE)
  async proxyProductNameSuggestions(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const url = `${this.targetBase}/api/v1/seller/product-content/name-suggestions`;
    const { data, status } = await this.proxyService.forward(url, req);
    res.status(status).json(data);
  }
}
