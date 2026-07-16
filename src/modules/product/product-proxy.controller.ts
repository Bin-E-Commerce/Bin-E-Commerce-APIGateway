import { All, Controller, Req, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import { Public } from "../../common/decorators/public.decorator";
import { ProxyService } from "../../common/services/proxy.service";

@Public()
@Controller("products")
export class ProductProxyController {
  private readonly targetBase: string;

  // Khởi tạo URL product-service để gateway chuyển tiếp các API danh sách và chi tiết sản phẩm.
  constructor(
    private readonly config: ConfigService,
    private readonly proxyService: ProxyService,
  ) {
    this.targetBase = config.get<string>(
      "PRODUCT_SERVICE_URL",
      "http://product-service:3008",
    );
  }

  // Chuyển request /api/v1/products sang product-service và giữ nguyên query params.
  @All()
  async proxyRoot(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.proxyToProduct(req, res);
  }

  // Chuyển toàn bộ /api/v1/products/* sang product-service để đọc chi tiết product.
  @All("*splat")
  async proxy(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.proxyToProduct(req, res);
  }

  // Dùng chung logic proxy để route gốc và route con không bị lệch upstream URL.
  private async proxyToProduct(req: Request, res: Response): Promise<void> {
    const path = req.path.replace(/^\/api/, "");
    const url = `${this.targetBase}/api${path}`;
    const { data, status } = await this.proxyService.forward(url, req);
    res.status(status).json(data);
  }
}
