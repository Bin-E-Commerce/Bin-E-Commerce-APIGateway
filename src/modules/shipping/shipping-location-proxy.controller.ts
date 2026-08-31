// Proxy master data GHN từ Shipping Service; browser không được biết token hoặc endpoint GHN.

import { Controller, Get, Req, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import { Public } from "../../common/decorators/public.decorator";
import { ProxyService } from "../../common/services/proxy.service";

@Public()
@Controller("shipping/locations")
export class ShippingLocationProxyController {
  private readonly targetBase: string;

  constructor(config: ConfigService, private readonly proxyService: ProxyService) {
    this.targetBase = config.get<string>("SHIPPING_SERVICE_URL", "http://localhost:3012");
  }

  // Chuyển tiếp danh sách tỉnh/thành phố GHN đã chuẩn hóa.
  @Get("provinces")
  async provinces(@Req() request: Request, @Res() response: Response): Promise<void> {
    await this.forward("provinces", request, response);
  }

  // Chuyển tiếp danh sách quận/huyện theo provinceId.
  @Get("districts")
  async districts(@Req() request: Request, @Res() response: Response): Promise<void> {
    await this.forward("districts", request, response);
  }

  // Chuyển tiếp danh sách phường/xã theo districtId.
  @Get("wards")
  async wards(@Req() request: Request, @Res() response: Response): Promise<void> {
    await this.forward("wards", request, response);
  }

  // Giữ nguyên query string để Shipping Service kiểm tra và chuyển tới GHN.
  private async forward(path: string, request: Request, response: Response): Promise<void> {
    const result = await this.proxyService.forward(`${this.targetBase}/api/v1/shipping/locations/${path}`, request);
    response.status(result.status).json(result.data);
  }
}
