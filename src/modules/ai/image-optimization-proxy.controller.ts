// HTTP boundary proxy cho dashboard tối ưu ảnh AI của seller.
// Controller chỉ guard permission và forward request; provider, Kafka và media lifecycle nằm ở service phía sau.

import { Body, Controller, Get, Param, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { Permission } from "@common/auth";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { ProxyService } from "../../common/services/proxy.service";
import { ConfigService } from "@nestjs/config";
import { CreateImageOptimizationJobDto } from "./dto/create-image-optimization-job.dto";

@Controller("seller/ai/image-optimization")
export class ImageOptimizationProxyController {
  private readonly targetBase: string;

  // Khởi tạo target AI Service từ env mà không đọc hay lưu OpenAI secret.
  constructor(
    config: ConfigService,
    private readonly proxyService: ProxyService,
  ) {
    this.targetBase = config.get<string>("AI_SERVICE_URL", "http://ai-service:3009");
  }

  // Forward overview sau khi gateway xác minh seller có quyền xem dashboard.
  @Get("overview")
  @RequirePermissions(Permission.SELLER_AI_IMAGE_OPTIMIZATION_VIEW)
  async overview(@Req() req: Request, @Res() res: Response): Promise<void> {
    const response = await this.proxyService.forward(`${this.targetBase}/api/v1/seller/ai/image-optimization/overview`, req);
    res.status(response.status).json(response.data);
  }

  // Tạo batch job và giữ status 202 từ AI Service để UI bắt đầu polling.
  @Post("jobs")
  @RequirePermissions(Permission.SELLER_AI_IMAGE_OPTIMIZATION_GENERATE)
  async createJobs(
    @Body() payload: CreateImageOptimizationJobDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    // Buộc NestJS chạy DTO validation trước khi forward; payload vẫn nằm trong req.body để ProxyService giữ nguyên contract.
    void payload;
    const response = await this.proxyService.forward(`${this.targetBase}/api/v1/seller/ai/image-optimization/jobs`, req);
    res.status(response.status).json(response.data);
  }

  // Lấy trạng thái job theo ID mà không chèn business rule vào gateway.
  @Get("jobs/:jobId")
  @RequirePermissions(Permission.SELLER_AI_IMAGE_OPTIMIZATION_VIEW)
  async getJob(@Param("jobId") jobId: string, @Req() req: Request, @Res() res: Response): Promise<void> {
    const response = await this.proxyService.forward(`${this.targetBase}/api/v1/seller/ai/image-optimization/jobs/${jobId}`, req);
    res.status(response.status).json(response.data);
  }

  // Forward yêu cầu apply sau khi seller duyệt preview.
  @Post("jobs/:jobId/apply")
  @RequirePermissions(Permission.SELLER_AI_IMAGE_OPTIMIZATION_APPLY)
  async applyJob(@Param("jobId") jobId: string, @Req() req: Request, @Res() res: Response): Promise<void> {
    const response = await this.proxyService.forward(`${this.targetBase}/api/v1/seller/ai/image-optimization/jobs/${jobId}/apply`, req);
    res.status(response.status).json(response.data);
  }

  // Forward từ chối output để AI Service lên lịch cleanup asset AI.
  @Post("jobs/:jobId/reject")
  @RequirePermissions(Permission.SELLER_AI_IMAGE_OPTIMIZATION_APPLY)
  async rejectJob(@Param("jobId") jobId: string, @Req() req: Request, @Res() res: Response): Promise<void> {
    const response = await this.proxyService.forward(`${this.targetBase}/api/v1/seller/ai/image-optimization/jobs/${jobId}/reject`, req);
    res.status(response.status).json(response.data);
  }

  // Forward rollback và để Product Service phục hồi snapshot ảnh gốc trong transaction.
  @Post("jobs/:jobId/rollback")
  @RequirePermissions(Permission.SELLER_AI_IMAGE_OPTIMIZATION_ROLLBACK)
  async rollbackJob(@Param("jobId") jobId: string, @Req() req: Request, @Res() res: Response): Promise<void> {
    const response = await this.proxyService.forward(`${this.targetBase}/api/v1/seller/ai/image-optimization/jobs/${jobId}/rollback`, req);
    res.status(response.status).json(response.data);
  }
}
