// Proxy tài chính admin áp dụng permission riêng trước khi forward thao tác đối soát xuống Order Service.
import { Controller, Param, ParseUUIDPipe, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { Permission } from '@common/auth';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { ProxyService } from '@/common/services/proxy.service';

// API không gọi ngân hàng; chỉ lưu kết quả remittance COD đã được admin kiểm tra ngoài hệ thống.
@Controller('admin/finance')
export class AdminFinanceProxyController {
    private readonly targetBase: string;

    // URL service được lấy từ cấu hình hiện hữu của gateway.
    constructor(config: ConfigService, private readonly proxyService: ProxyService) {
        this.targetBase = config.get<string>('ORDER_SERVICE_URL', 'http://localhost:3011');
    }

    // Yêu cầu quyền admin.finance.reconcile và chuyển tiếp idempotency/identity context đã xác thực.
    @Post('cod-remittances/:orderId/confirmation')
    @RequirePermissions(Permission.ADMIN_FINANCE_RECONCILE)
    async confirmCodRemittance(@Param('orderId', new ParseUUIDPipe()) orderId: string, @Req() request: Request, @Res() response: Response): Promise<void> {
        const { data, status } = await this.proxyService.forward(
            `${this.targetBase}/api/v1/admin/finance/cod-remittances/${orderId}/confirmation`,
            request,
        );
        response.status(status).json(data);
    }

    // Forward COD refund confirmation only for finance admins; proof/amount are validated in Order Service.
    @Post('cod-refunds/:returnId/confirmation')
    @RequirePermissions(Permission.ADMIN_FINANCE_RECONCILE)
    async confirmCodRefund(@Param('returnId', new ParseUUIDPipe()) returnId: string, @Req() request: Request, @Res() response: Response): Promise<void> {
        const { data, status } = await this.proxyService.forward(
            `${this.targetBase}/api/v1/admin/finance/cod-refunds/${returnId}/confirmation`,
            request,
        );
        response.status(status).json(data);
    }

    // Retry chỉ dành cho hoàn VNPay đã lỗi xác định; trạng thái chưa rõ không được phát sinh requestId mới.
    @Post('vnpay-refunds/:returnId/retry')
    @RequirePermissions(Permission.ADMIN_FINANCE_RECONCILE)
    async retryVnpayRefund(@Param('returnId', new ParseUUIDPipe()) returnId: string, @Req() request: Request, @Res() response: Response): Promise<void> {
        const { data, status } = await this.proxyService.forward(
            `${this.targetBase}/api/v1/admin/finance/vnpay-refunds/${returnId}/retry`,
            request,
        );
        response.status(status).json(data);
    }
}
