// Public proxy nhận IPN VNPay; gateway chuyển nguyên query đã ký mà không áp dụng JWT người mua.
import { Controller, Get, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { Public } from '@/common/decorators/public.decorator';
import { ProxyService } from '@/common/services/proxy.service';

// Chỉ route này mở công khai; Order Service vẫn xác thực HMAC, amount và transaction reference.
@Controller('payments/vnpay')
export class VnpayIpnProxyController {
    private readonly targetBase: string;

    // Đọc URL nội bộ order-service từ config để không hardcode host theo môi trường.
    constructor(config: ConfigService, private readonly proxyService: ProxyService) {
        this.targetBase = config.get<string>('ORDER_SERVICE_URL', 'http://localhost:3011');
    }

    // VNPay IPN thường gửi GET; chỉ giữ query gốc vì mọi trường tham gia chữ ký phải đến nguyên dạng.
    @Get('ipn')
    @Public()
    async processIpn(@Req() request: Request, @Res() response: Response): Promise<void> {
        await this.forwardCallback('ipn', request, response);
    }

    // Forward Return và IPN bằng query string nguyên gốc để phần dữ liệu đã ký không bị tái mã hóa ở gateway.
    @Get('return')
    @Public()
    async processReturn(@Req() request: Request, @Res() response: Response): Promise<void> {
        await this.forwardCallback('return', request, response);
    }

    // Giữ query gốc trên URL để không làm thay đổi dữ liệu ký; tắt việc ProxyService thêm req.query lần nữa.
    private async forwardCallback(
        callbackType: 'ipn' | 'return',
        request: Request,
        response: Response,
    ): Promise<void> {
        const queryString = request.originalUrl.includes('?')
            ? request.originalUrl.slice(request.originalUrl.indexOf('?'))
            : '';
        const { data, status } = await this.proxyService.forward(
            `${this.targetBase}/api/v1/payments/vnpay/${callbackType}${queryString}`,
            request,
            {},
            { includeQueryParams: false },
        );
        response.status(status).json(data);
    }
}
