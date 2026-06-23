import { All, Controller, Req, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import { Public } from "../../common/decorators/public.decorator";
import { ProxyService } from "../../common/services/proxy.service";

@Public()
@Controller("locations")
export class LocationProxyController {
  private readonly targetBase: string;

  // Khởi tạo URL location-service để gateway chuyển tiếp API địa chỉ dùng chung.
  constructor(
    private readonly config: ConfigService,
    private readonly proxyService: ProxyService,
  ) {
    this.targetBase = config.get<string>(
      "LOCATION_SERVICE_URL",
      "http://location-service:3006",
    );
  }

  // Chuyển request /api/v1/locations sang location-service và giữ nguyên query params.
  @All()
  async proxyRoot(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.proxyToLocation(req, res);
  }

  // Chuyển toàn bộ /api/v1/locations/* sang location-service.
  @All("*splat")
  async proxy(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.proxyToLocation(req, res);
  }

  // Dùng chung logic build URL upstream để route gốc và route con không bị lệch path.
  private async proxyToLocation(req: Request, res: Response): Promise<void> {
    const path = req.path.replace(/^\/api/, "");
    const url = `${this.targetBase}/api${path}`;
    const { data, status } = await this.proxyService.forward(url, req);
    res.status(status).json(data);
  }
}
