import { All, Controller, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { ConfigService } from "@nestjs/config";
import { ProxyService } from "../../common/services/proxy.service";

// Cung cấp endpoint /api/notifications/* để chuyển tiếp
// các yêu cầu liên quan đến thông báo đến Notification Service.
@Controller("notifications")
export class NotificationProxyController {
  private readonly targetBase: string;

  constructor(
    private readonly config: ConfigService,
    private readonly proxyService: ProxyService,
  ) {
    this.targetBase = config.get<string>(
      "NOTIFICATION_SERVICE_URL",
      "http://notification-service:3005",
    );
  }

  // Route gốc cần handler riêng vì wildcard của Express 5 không khớp /api/v1/notifications khi không có segment phía sau.
  @All()
  async proxyRoot(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.proxyToNotification(req, res);
  }

  // Chuyển tiếp các route con như unread-counts, read-all và :id/read tới notification-service.
  @All("*splat")
  async proxy(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.proxyToNotification(req, res);
  }

  // Dùng chung cách dựng upstream URL để route gốc và route con luôn giữ đúng version cùng query parameters.
  private async proxyToNotification(
    req: Request,
    res: Response,
  ): Promise<void> {
    const path = req.path.replace(/^\/api/, "");
    const url = `${this.targetBase}/api${path}`;
    const { data, status } = await this.proxyService.forward(url, req);
    res.status(status).json(data);
  }
}
