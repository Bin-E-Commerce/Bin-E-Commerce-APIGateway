import { All, Controller, Req, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import { Public } from "../../common/decorators/public.decorator";
import { ProxyService } from "../../common/services/proxy.service";

@Public()
@Controller("categories")
export class CatalogProxyController {
  private readonly targetBase: string;

  // Khởi tạo URL của catalog-service để gateway chuyển tiếp các API danh mục.
  constructor(
    private readonly config: ConfigService,
    private readonly proxyService: ProxyService,
  ) {
    this.targetBase = config.get<string>(
      "CATALOG_SERVICE_URL",
      "http://catalog-service:3003",
    );
  }

  // Chuyển request /api/v1/categories sang catalog-service để lấy danh mục gốc.
  @All()
  async proxyRoot(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.proxyToCatalog(req, res);
  }

  // Chuyển toàn bộ /api/v1/categories/* sang catalog-service và giữ nguyên query params.
  @All("*splat")
  async proxy(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.proxyToCatalog(req, res);
  }

  // Dùng chung logic chuyển tiếp để route gốc và route con không bị lệch URL upstream.
  private async proxyToCatalog(req: Request, res: Response): Promise<void> {
    const path = req.path.replace(/^\/api/, "");
    const url = `${this.targetBase}/api${path}`;
    const { data, status } = await this.proxyService.forward(url, req);
    res.status(status).json(data);
  }
}
