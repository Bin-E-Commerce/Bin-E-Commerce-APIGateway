// Public proxy giữ nguyên callback Pay2S; Order Service xác minh IPN và webhook token trước khi ghi dữ liệu.
import { Controller, Get, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { Public } from '@/common/decorators/public.decorator';
import { SkipCsrf } from '@/common/decorators/skip-csrf.decorator';
import { ProxyService } from '@/common/services/proxy.service';

@Controller('payments/pay2s')
export class Pay2sCallbackProxyController {
    private readonly targetBase: string;

    // Callback URL nội bộ được cấu hình tại Gateway để Pay2S không biết topology service.
    constructor(
        config: ConfigService,
        private readonly proxyService: ProxyService,
    ) {
        this.targetBase = config.get<string>(
            'ORDER_SERVICE_URL',
            'http://localhost:3011',
        );
    }

    // IPN đến từ máy chủ Pay2S nên không có CSRF header hoặc JWT của trình duyệt.
    // SkipCsrf chỉ bỏ kiểm tra header; Order Service vẫn phải xác minh chữ ký Pay2S trước khi cập nhật đơn.
    @Post('ipn')
    @Public()
    @SkipCsrf()
    async processIpn(
        @Req() request: Request,
        @Res() response: Response,
    ): Promise<void> {
        const { data, status } = await this.proxyService.forward(
            `${this.targetBase}/api/v1/payments/pay2s/ipn`,
            request,
            {},
            { includeQueryParams: false },
        );
        response.status(status).json(data);
    }

    // Redirect GET giữ nguyên query gốc; frontend chỉ dùng kết quả sau khi Order Service verify.
    @Get('return')
    @Public()
    async processReturn(
        @Req() request: Request,
        @Res() response: Response,
    ): Promise<void> {
        const queryString = request.originalUrl.includes('?')
            ? request.originalUrl.slice(request.originalUrl.indexOf('?'))
            : '';
        const { data, status } = await this.proxyService.forward(
            `${this.targetBase}/api/v1/payments/pay2s/return${queryString}`,
            request,
            {},
            { includeQueryParams: false },
        );
        response.status(status).json(data);
    }
}
