// Public proxy nhận webhook tiền ra SePay; API Key được chuyển nguyên vẹn để Order Service xác thực.
import { Controller, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { Public } from '@/common/decorators/public.decorator';
import { SkipCsrf } from '@/common/decorators/skip-csrf.decorator';
import { ProxyService } from '@/common/services/proxy.service';

// Public route chỉ chuyển webhook SePay tới Order Service; không chứa business logic hay bí mật đối soát.
@Controller('payments/sepay')
export class SepayPayoutProxyController {
    private readonly targetBase: string;

    // Gateway chỉ định tuyến callback; khóa bí mật và quyết định ghi payout thuộc Order Service.
    constructor(
        config: ConfigService,
        private readonly proxyService: ProxyService,
    ) {
        this.targetBase = config.get<string>(
            'ORDER_SERVICE_URL',
            'http://localhost:3011',
        );
    }

    // Webhook không có JWT/CSRF; API Key của SePay được giữ nguyên qua proxy và xác thực ở backend nghiệp vụ.
    @Post('payout-webhook')
    @Public()
    @SkipCsrf()
    async processPayoutWebhook(
        @Req() request: Request,
        @Res() response: Response,
    ): Promise<void> {
        const { data, status } = await this.proxyService.forward(
            `${this.targetBase}/api/v1/payments/sepay/payout-webhook`,
            request,
            {
                authorization: String(request.headers.authorization ?? ''),
            },
            { includeQueryParams: false },
        );
        response.status(status).json(data);
    }
}
