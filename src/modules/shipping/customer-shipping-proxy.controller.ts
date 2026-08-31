// File này forward customer tracking và để Shipping Service kiểm tra owner lần cuối.

import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { Permission } from '@common/auth';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ProxyService } from '../../common/services/proxy.service';

@Controller('orders')
export class CustomerShippingProxyController {
  private readonly targetBase: string;

  // Đọc Shipping Service URL tập trung để không hard-code endpoint trong controller.
  constructor(config: ConfigService, private readonly proxyService: ProxyService) {
    this.targetBase = config.get<string>('SHIPPING_SERVICE_URL', 'http://localhost:3012');
  }

  // Customer tracking chỉ được gọi với permission own-scope do Gateway resolve từ JWT.
  @Get(':orderId/tracking')
  @RequirePermissions(Permission.SHIPPING_TRACKING_READ)
  async get(@Param('orderId') orderId: string, @Req() request: Request, @Res() response: Response): Promise<void> {
    const result = await this.proxyService.forward(`${this.targetBase}/api/v1/orders/${orderId}/tracking`, request);
    response.status(result.status).json(result.data);
  }
}
