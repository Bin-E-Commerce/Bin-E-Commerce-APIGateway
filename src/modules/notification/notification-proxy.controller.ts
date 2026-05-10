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
      "http://notification-service:3006",
    );
  }

  @All("*splat")
  async proxy(@Req() req: Request, @Res() res: Response): Promise<void> {
    const path = req.path.replace(/^\/api/, "");
    const url = `${this.targetBase}/api${path}`;
    const { data, status } = await this.proxyService.forward(url, req);
    res.status(status).json(data);
  }
}
