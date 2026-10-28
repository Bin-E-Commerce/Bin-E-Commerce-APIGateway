// Public proxy chuyển webhook Pay2S payout tới Order Service để xác thực và ghi candidate.
import { Controller, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { Public } from '@/common/decorators/public.decorator';
import { SkipCsrf } from '@/common/decorators/skip-csrf.decorator';
import { ProxyService } from '@/common/services/proxy.service';

// Gateway chỉ định tuyến callback; token bí mật và quyết định ghi nhận thuộc Order Service.
@Controller({ path: 'payments/pay2s', version: '1' })
export class Pay2sPayoutProxyController {
    private readonly targetBase: string;

    // URL Order Service được lấy từ cấu hình hiện có của gateway.
    constructor(
        config: ConfigService,
        private readonly proxyService: ProxyService,
    ) {
        this.targetBase = config.get<string>(
            'ORDER_SERVICE_URL',
            'http://localhost:3011',
        );
    }

    // Public webhook không có JWT/CSRF; giữ nguyên Authorization Bearer để Order Service tự xác thực.
    @Post('payout-webhook')
    @Public()
    @SkipCsrf()
    async processPayoutWebhook(
        @Req() request: Request,
        @Res() response: Response,
    ): Promise<void> {
        const { data, status } = await this.proxyService.forward(
            `${this.targetBase}/api/v1/payments/pay2s/payout-webhook`,
            request,
            {
                authorization: String(request.headers.authorization ?? ''),
            },
            { includeQueryParams: false },
        );
        response.status(status).json(data);
    }
}
