// File này định tuyến product/review request qua API Gateway.
// Gateway chịu trách nhiệm guest/auth/permission và forward identity; business rule nằm ở Product Service.
import { Controller, Delete, Get, Patch, Post, Put, Req, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import { Permission } from "@common/auth";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { AllowGuest } from "../../common/decorators/allow-guest.decorator";
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

  // Danh mục thương hiệu là dữ liệu tham chiếu công khai cho bộ lọc và form tạo sản phẩm.
  @Public()
  @Get("brands")
  async proxyPublicBrands(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.proxyToProduct(req, res, "/v1/brands");
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

  // Chi tiết seller dùng endpoint có ownership riêng và kế thừa cùng quyền đọc với danh sách sản phẩm.
  @Get("seller/:productId")
  @RequirePermissions(Permission.SELLER_PRODUCT_READ)
  async proxySellerProductDetail(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.proxyToProduct(
      req,
      res,
      `/v1/seller/products/${req.params.productId}`,
    );
  }

  // Chỉ tài khoản có quyền tạo product mới được chuyển payload xuống Product Service.
  @Post("seller")
  @RequirePermissions(Permission.SELLER_PRODUCT_CREATE)
  async proxyCreateSellerProduct(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.proxyToProduct(req, res, "/v1/seller/products");
  }

  // Chuyển payload chỉnh sửa tới Product Service với permission riêng để seller chỉ sửa sản phẩm thuộc shop của mình.
  @Put("seller/:productId")
  @RequirePermissions(Permission.SELLER_PRODUCT_UPDATE)
  async proxyUpdateSellerProduct(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.proxyToProduct(
      req,
      res,
      `/v1/seller/products/${req.params.productId}`,
    );
  }

  // Chuyển yêu cầu xóa mềm tới Product Service với permission delete riêng của seller.
  @Delete("seller/:productId")
  @RequirePermissions(Permission.SELLER_PRODUCT_DELETE)
  async proxyDeleteSellerProduct(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.proxyToProduct(
      req,
      res,
      `/v1/seller/products/${req.params.productId}`,
    );
  }

  // Chuyển yêu cầu khôi phục product đã xóa mềm với permission riêng của seller.
  @Post("seller/:productId/restore")
  @RequirePermissions(Permission.SELLER_PRODUCT_RESTORE)
  async proxyRestoreSellerProduct(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.proxyToProduct(
      req,
      res,
      `/v1/seller/products/${req.params.productId}/restore`,
    );
  }

  // Chuyển thao tác bật/tắt sang contract PATCH riêng, không gửi lại toàn bộ product graph.
  @Patch("seller/:productId/status")
  @RequirePermissions(Permission.SELLER_PRODUCT_STATUS_UPDATE)
  async proxyChangeSellerProductStatus(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.proxyToProduct(
      req,
      res,
      `/v1/seller/products/${req.params.productId}/status`,
    );
  }

  // Customer lấy trạng thái review theo order để nút “Đánh giá ngay” không cần gọi từng product riêng lẻ.
  @Get("reviews/me")
  @RequirePermissions(Permission.ORDER_READ)
  async proxyMyReviews(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.proxyToProduct(req, res, "/v1/reviews/me");
  }

  // Chi tiết sản phẩm storefront là dữ liệu công khai; route đặt sau /seller để tránh hiểu "seller" là product ID.
  @AllowGuest()
  @Get(":id")
  async proxyPublicProductDetail(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.proxyToProduct(req, res);
  }

  // Customer tạo review qua Gateway; Product Service sẽ tự đối chiếu orderItem với Order Service.
  @Post(":productId/reviews")
  @RequirePermissions(Permission.PRODUCT_REVIEW_CREATE)
  async proxyCreateProductReview(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.proxyToProduct(req, res, `/v1/products/${req.params.productId}/reviews`);
  }

  // Customer chỉnh sửa review của chính mình; Product Service tiếp tục kiểm tra purchase proof và deadline.
  @Patch("reviews/:reviewId")
  @RequirePermissions(Permission.PRODUCT_REVIEW_CREATE)
  async proxyUpdateProductReview(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.proxyToProduct(req, res, `/v1/products/reviews/${req.params.reviewId}`);
  }

  // Dọn asset review upload dở dang qua Product Service để Media Service vẫn được bảo vệ bằng owner scope.
  @Post("reviews/media/cleanup")
  @RequirePermissions(Permission.PRODUCT_REVIEW_CREATE)
  async proxyCleanupUploadedReviewMedia(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.proxyToProduct(req, res, "/v1/products/reviews/media/cleanup");
  }

  // Customer đã đăng nhập có thể thích review; permission review hiện tại được dùng chung cho thao tác tương tác review.
  @Put("reviews/:reviewId/like")
  @RequirePermissions(Permission.PRODUCT_REVIEW_CREATE)
  async proxyLikeProductReview(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.proxyToProduct(req, res, `/v1/reviews/${req.params.reviewId}/like`);
  }

  // Bỏ like qua cùng boundary để user context và CSRF được kiểm tra như lúc thêm like.
  @Delete("reviews/:reviewId/like")
  @RequirePermissions(Permission.PRODUCT_REVIEW_CREATE)
  async proxyUnlikeProductReview(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.proxyToProduct(req, res, `/v1/reviews/${req.params.reviewId}/like`);
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
