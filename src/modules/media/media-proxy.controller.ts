import { All, Controller, Req, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import { ProxyService } from "../../common/services/proxy.service";

@Controller("media")
export class MediaProxyController {
  private readonly targetBase: string;

  // Khởi tạo URL đích của media-service để gateway chỉ đóng vai trò xác thực và chuyển tiếp request.
  constructor(
    private readonly config: ConfigService,
    private readonly proxyService: ProxyService,
  ) {
    this.targetBase = config.get<string>(
      "MEDIA_SERVICE_URL",
      "http://media-service:3010",
    );
  }

  // Chuyển tiếp toàn bộ /api/v1/media/* sang media-service sau khi JWT/CSRF guard đã kiểm tra ở gateway.
  @All("*splat")
  async proxy(@Req() req: Request, @Res() res: Response): Promise<void> {
    const path = req.path.replace(/^\/api/, "");
    const url = `${this.targetBase}/api${path}`;
    const { data, status } = await this.proxyService.forward(url, req);
    res.status(status).json(data);
  }
}
