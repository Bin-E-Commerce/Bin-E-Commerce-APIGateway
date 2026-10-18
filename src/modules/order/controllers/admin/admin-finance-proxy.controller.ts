// Proxy tài chính admin áp dụng permission riêng trước khi forward thao tác đối soát xuống Order Service.
import {
    Controller,
    Get,
    Param,
    ParseUUIDPipe,
    Post,
    Req,
    Res,
} from '@nestjs/common';
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
    constructor(
        config: ConfigService,
        private readonly proxyService: ProxyService,
    ) {
        this.targetBase = config.get<string>(
            'ORDER_SERVICE_URL',
            'http://localhost:3011',
        );
    }

    // Chỉ người có quyền đọc tài chính được xem snapshot dòng tiền mô phỏng.
    @Get('overview')
    @RequirePermissions(Permission.ADMIN_FINANCE_READ)
    async getOverview(
        @Req() request: Request,
        @Res() response: Response,
    ): Promise<void> {
        const { data, status } = await this.proxyService.forward(
            `${this.targetBase}/api/v1/admin/finance/overview`,
            request,
        );
        response.status(status).json(data);
    }

    // Trả ledger nền tảng đã phân trang, không gồm dữ liệu tài khoản ngân hàng thô.
    @Get('ledger')
    @RequirePermissions(Permission.ADMIN_FINANCE_READ)
    async getLedger(
        @Req() request: Request,
        @Res() response: Response,
    ): Promise<void> {
        const { data, status } = await this.proxyService.forward(
            `${this.targetBase}/api/v1/admin/finance/ledger`,
            request,
        );
        response.status(status).json(data);
    }

    // Danh sách yêu cầu rút dùng mã tài khoản đã mask; detail có quyền payout riêng.
    @Get('withdrawals')
    @RequirePermissions(Permission.ADMIN_FINANCE_READ)
    async getWithdrawals(
        @Req() request: Request,
        @Res() response: Response,
    ): Promise<void> {
        const { data, status } = await this.proxyService.forward(
            `${this.targetBase}/api/v1/admin/finance/withdrawals`,
            request,
        );
        response.status(status).json(data);
    }

    // Chỉ quyền payout mới cho phép xem tài khoản nhận đầy đủ để admin tự chuyển khoản ngoài hệ thống.
    @Get('withdrawals/:withdrawalId')
    @RequirePermissions(Permission.ADMIN_FINANCE_PAYOUT)
    async getWithdrawal(
        @Param('withdrawalId', new ParseUUIDPipe()) withdrawalId: string,
        @Req() request: Request,
        @Res() response: Response,
    ): Promise<void> {
        const { data, status } = await this.proxyService.forward(
            `${this.targetBase}/api/v1/admin/finance/withdrawals/${withdrawalId}`,
            request,
        );
        response.status(status).json(data);
    }

    // Trạng thái PROCESSING chỉ cập nhật workflow; khoản tiền đã được giữ ở lúc seller yêu cầu.
    @Post('withdrawals/:withdrawalId/processing')
    @RequirePermissions(Permission.ADMIN_FINANCE_PAYOUT)
    async markWithdrawalProcessing(
        @Param('withdrawalId', new ParseUUIDPipe()) withdrawalId: string,
        @Req() request: Request,
        @Res() response: Response,
    ): Promise<void> {
        const { data, status } = await this.proxyService.forward(
            `${this.targetBase}/api/v1/admin/finance/withdrawals/${withdrawalId}/processing`,
            request,
        );
        response.status(status).json(data);
    }

    // Chỉ sau chuyển khoản thủ công admin mới xác nhận PAID và chốt trừ số dư seller.
    @Post('withdrawals/:withdrawalId/paid')
    @RequirePermissions(Permission.ADMIN_FINANCE_PAYOUT)
    async confirmWithdrawalPaid(
        @Param('withdrawalId', new ParseUUIDPipe()) withdrawalId: string,
        @Req() request: Request,
        @Res() response: Response,
    ): Promise<void> {
        const { data, status } = await this.proxyService.forward(
            `${this.targetBase}/api/v1/admin/finance/withdrawals/${withdrawalId}/paid`,
            request,
        );
        response.status(status).json(data);
    }

    // Từ chối payout giải phóng khoản giữ chỗ về ví và không tạo dòng tiền ra nền tảng.
    @Post('withdrawals/:withdrawalId/reject')
    @RequirePermissions(Permission.ADMIN_FINANCE_PAYOUT)
    async rejectWithdrawal(
        @Param('withdrawalId', new ParseUUIDPipe()) withdrawalId: string,
        @Req() request: Request,
        @Res() response: Response,
    ): Promise<void> {
        const { data, status } = await this.proxyService.forward(
            `${this.targetBase}/api/v1/admin/finance/withdrawals/${withdrawalId}/reject`,
            request,
        );
        response.status(status).json(data);
    }

    // Chuyển khoản lỗi cũng nhả khoản giữ chỗ; UI có thể yêu cầu seller gửi lại sau khi sửa ngân hàng.
    @Post('withdrawals/:withdrawalId/fail')
    @RequirePermissions(Permission.ADMIN_FINANCE_PAYOUT)
    async failWithdrawal(
        @Param('withdrawalId', new ParseUUIDPipe()) withdrawalId: string,
        @Req() request: Request,
        @Res() response: Response,
    ): Promise<void> {
        const { data, status } = await this.proxyService.forward(
            `${this.targetBase}/api/v1/admin/finance/withdrawals/${withdrawalId}/fail`,
            request,
        );
        response.status(status).json(data);
    }

    // Đợt đối soát dùng quyền reconcile hiện có và chỉ gắn các dòng ledger chưa được phân nhóm.
    @Post('settlement-batches')
    @RequirePermissions(Permission.ADMIN_FINANCE_RECONCILE)
    async createSettlementBatch(
        @Req() request: Request,
        @Res() response: Response,
    ): Promise<void> {
        const { data, status } = await this.proxyService.forward(
            `${this.targetBase}/api/v1/admin/finance/settlement-batches`,
            request,
        );
        response.status(status).json(data);
    }

    // Ghi nhận đợt đã đối soát nhưng không ảnh hưởng trạng thái payment hay release seller wallet.
    @Post('settlement-batches/:batchId/reconcile')
    @RequirePermissions(Permission.ADMIN_FINANCE_RECONCILE)
    async reconcileSettlementBatch(
        @Param('batchId', new ParseUUIDPipe()) batchId: string,
        @Req() request: Request,
        @Res() response: Response,
    ): Promise<void> {
        const { data, status } = await this.proxyService.forward(
            `${this.targetBase}/api/v1/admin/finance/settlement-batches/${batchId}/reconcile`,
            request,
        );
        response.status(status).json(data);
    }

    // Yêu cầu quyền admin.finance.reconcile và chuyển tiếp idempotency/identity context đã xác thực.
    @Post('cod-remittances/:orderId/confirmation')
    @RequirePermissions(Permission.ADMIN_FINANCE_RECONCILE)
    async confirmCodRemittance(
        @Param('orderId', new ParseUUIDPipe()) orderId: string,
        @Req() request: Request,
        @Res() response: Response,
    ): Promise<void> {
        const { data, status } = await this.proxyService.forward(
            `${this.targetBase}/api/v1/admin/finance/cod-remittances/${orderId}/confirmation`,
            request,
        );
        response.status(status).json(data);
    }

    // Forward COD refund confirmation only for finance admins; proof/amount are validated in Order Service.
    @Post('cod-refunds/:returnId/confirmation')
    @RequirePermissions(Permission.ADMIN_FINANCE_RECONCILE)
    async confirmCodRefund(
        @Param('returnId', new ParseUUIDPipe()) returnId: string,
        @Req() request: Request,
        @Res() response: Response,
    ): Promise<void> {
        const { data, status } = await this.proxyService.forward(
            `${this.targetBase}/api/v1/admin/finance/cod-refunds/${returnId}/confirmation`,
            request,
        );
        response.status(status).json(data);
    }

    // Retry chỉ dành cho hoàn VNPay đã lỗi xác định; trạng thái chưa rõ không được phát sinh requestId mới.
    @Post('vnpay-refunds/:returnId/retry')
    @RequirePermissions(Permission.ADMIN_FINANCE_RECONCILE)
    async retryVnpayRefund(
        @Param('returnId', new ParseUUIDPipe()) returnId: string,
        @Req() request: Request,
        @Res() response: Response,
    ): Promise<void> {
        const { data, status } = await this.proxyService.forward(
            `${this.targetBase}/api/v1/admin/finance/vnpay-refunds/${returnId}/retry`,
            request,
        );
        response.status(status).json(data);
    }
}
