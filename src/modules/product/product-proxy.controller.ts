import { Controller, Get, Req, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import { Permission } from "@common/auth";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { ProxyService } from "../../common/services/proxy.service";

@Controller("products")
export class ProductProxyController {
  private readonly targetBase: string;

  // Khởi tạo URL Product Service dùng chung cho các route public và route quản trị của seller.
  constructor(
    private readonly config: ConfigService,
    private readonly proxyService: ProxyService,
  ) {
    this.targetBase = config.get<string>(
      "PRODUCT_SERVICE_URL",
      "http://product-service:3008",
    );
  }

  // Danh sách sản phẩm trên storefront là dữ liệu công khai nên không yêu cầu access token.
  @Public()
  @Get()
  async proxyPublicProducts(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.proxyToProduct(req, res);
  }

  // Gateway kiểm tra quyền module trước khi chuyển user context xuống Product Service để lọc ownership.
  @Get("seller")
  @RequirePermissions(Permission.SELLER_PRODUCT_READ)
  async proxySellerProducts(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    // Public URL giữ dạng /products/seller, còn URL nội bộ tách namespace để không đụng /products/:id.
    // internalPath phải giữ `/v1` vì proxy helper sẽ ghép thêm prefix `/api` của Product Service.
    await this.proxyToProduct(req, res, "/v1/seller/products");
  }

  // Chi tiết sản phẩm storefront là dữ liệu công khai; route đặt sau /seller để tránh hiểu "seller" là product ID.
  @Public()
  @Get(":id")
  async proxyPublicProductDetail(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.proxyToProduct(req, res);
  }

  // Giữ nguyên path, query và user context khi chuyển request sang Product Service.
  private async proxyToProduct(
    req: Request,
    res: Response,
    internalPath?: string,
  ): Promise<void> {
    const path = internalPath ?? req.path.replace(/^\/api/, "");
    const url = `${this.targetBase}/api${path}`;
    const { data, status } = await this.proxyService.forward(url, req);
    res.status(status).json(data);
  }
}
