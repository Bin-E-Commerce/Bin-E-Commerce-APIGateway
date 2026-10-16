// Proxy ví seller bảo vệ endpoint bằng quyền tài chính own_shop trước khi forward context đã xác thực.
import { Controller, Get, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { Permission } from '@common/auth';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { ProxyService } from '@/common/services/proxy.service';

// Controller chỉ đọc snapshot ví; không cung cấp API yêu cầu rút hoặc sửa số dư.
@Controller('seller/finance')
export class SellerFinanceProxyController {
    private readonly targetBase: string;

    // Lấy base URL service từ config giống các proxy order khác.
    constructor(config: ConfigService, private readonly proxyService: ProxyService) {
        this.targetBase = config.get<string>('ORDER_SERVICE_URL', 'http://localhost:3011');
    }

    // Gateway yêu cầu grant seller.finance.read; Order Service resolve lại shop theo user context.
    @Get('wallet')
    @RequirePermissions(Permission.SELLER_FINANCE_READ)
    async getWallet(@Req() request: Request, @Res() response: Response): Promise<void> {
        const { data, status } = await this.proxyService.forward(
            `${this.targetBase}/api/v1/seller/finance/wallet`,
            request,
        );
        response.status(status).json(data);
    }
}
