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

    // Chỉ quyền đọc finance mới nhận tổng giao dịch ví đã gom theo ngày, không có dữ liệu nhận dạng seller.
    @Get('activity')
    @RequirePermissions(Permission.ADMIN_FINANCE_READ)
    async getActivity(
        @Req() request: Request,
        @Res() response: Response,
    ): Promise<void> {
        const { data, status } = await this.proxyService.forward(
            `${this.targetBase}/api/v1/admin/finance/activity`,
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

    // Trạng thái cấu hình chỉ lộ cho admin có quyền payout và không chứa API Key.
    @Get('payout-readiness')
    @RequirePermissions(Permission.ADMIN_FINANCE_PAYOUT)
    async getPayoutReadiness(
        @Req() request: Request,
        @Res() response: Response,
    ): Promise<void> {
        const { data, status } = await this.proxyService.forward(
            `${this.targetBase}/api/v1/admin/finance/payout-readiness`,
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

    // Chỉ admin có quyền đọc tài chính được xem COD đã hoàn tất đang chờ đối soát remittance.
    @Get('cod-remittances')
    @RequirePermissions(Permission.ADMIN_FINANCE_READ)
    async getPendingCodRemittances(
        @Req() request: Request,
        @Res() response: Response,
    ): Promise<void> {
        const { data, status } = await this.proxyService.forward(
            `${this.targetBase}/api/v1/admin/finance/cod-remittances`,
            request,
        );
        response.status(status).json(data);
    }

    // Chuyển tiếp hàng đợi hoàn tiền; quyền đọc chỉ cho phép xem dữ liệu, không cho chốt giao dịch.
    @Get('refunds')
    @RequirePermissions(Permission.ADMIN_FINANCE_READ)
    async getRefunds(
        @Req() request: Request,
        @Res() response: Response,
    ): Promise<void> {
        const { data, status } = await this.proxyService.forward(
            `${this.targetBase}/api/v1/admin/finance/refunds`,
            request,
        );
        response.status(status).json(data);
    }

    // Trả các khiếu nại chưa nhận hàng để admin có quyền đọc tài chính phân xử.
    @Get('delivery-issues')
    @RequirePermissions(Permission.ADMIN_FINANCE_READ)
    async getDeliveryIssues(
        @Req() request: Request,
        @Res() response: Response,
    ): Promise<void> {
        const { data, status } = await this.proxyService.forward(
            `${this.targetBase}/api/v1/admin/finance/delivery-issues`,
            request,
        );
        response.status(status).json(data);
    }

    // Quyết định hoàn hoặc từ chối khiếu nại cần quyền reconcile; Order Service kiểm tra trạng thái và ghi audit.
    @Post('delivery-issues/:issueId/resolution')
    @RequirePermissions(Permission.ADMIN_FINANCE_RECONCILE)
    async resolveDeliveryIssue(
        @Param('issueId', new ParseUUIDPipe()) issueId: string,
        @Req() request: Request,
        @Res() response: Response,
    ): Promise<void> {
        const { data, status } = await this.proxyService.forward(
            `${this.targetBase}/api/v1/admin/finance/delivery-issues/${issueId}/resolution`,
            request,
        );
        response.status(status).json(data);
    }

    // Chuyển tiếp xác nhận chuyển tiền cho attempt Pay2S; bằng chứng và số tiền được Order Service xác thực.
    @Post('refunds/payment-attempts/:attemptId/confirmation')
    @RequirePermissions(Permission.ADMIN_FINANCE_RECONCILE)
    async confirmPaymentAttemptRefund(
        @Param('attemptId', new ParseUUIDPipe()) attemptId: string,
        @Req() request: Request,
        @Res() response: Response,
    ): Promise<void> {
        const { data, status } = await this.proxyService.forward(
            `${this.targetBase}/api/v1/admin/finance/refunds/payment-attempts/${attemptId}/confirmation`,
            request,
        );
        response.status(status).json(data);
    }

    // Ghi nhận lần chuyển Pay2S thất bại để admin xử lý lại trong refund queue.
    @Post('refunds/payment-attempts/:attemptId/failure')
    @RequirePermissions(Permission.ADMIN_FINANCE_RECONCILE)
    async failPaymentAttemptRefund(
        @Param('attemptId', new ParseUUIDPipe()) attemptId: string,
        @Req() request: Request,
        @Res() response: Response,
    ): Promise<void> {
        const { data, status } = await this.proxyService.forward(
            `${this.targetBase}/api/v1/admin/finance/refunds/payment-attempts/${attemptId}/failure`,
            request,
        );
        response.status(status).json(data);
    }

    // Chuyển tiếp xác nhận hoàn yêu cầu trả hàng; chỉ admin reconcile mới được ghi nhận tiền đã chuyển.
    @Post('refunds/returns/:returnId/confirmation')
    @RequirePermissions(Permission.ADMIN_FINANCE_RECONCILE)
    async confirmReturnRefund(
        @Param('returnId', new ParseUUIDPipe()) returnId: string,
        @Req() request: Request,
        @Res() response: Response,
    ): Promise<void> {
        const { data, status } = await this.proxyService.forward(
            `${this.targetBase}/api/v1/admin/finance/refunds/returns/${returnId}/confirmation`,
            request,
        );
        response.status(status).json(data);
    }

    // Giữ yêu cầu trả hàng trong hàng đợi khi giao dịch hoàn thất bại và lưu lý do để retry.
    @Post('refunds/returns/:returnId/failure')
    @RequirePermissions(Permission.ADMIN_FINANCE_RECONCILE)
    async failReturnRefund(
        @Param('returnId', new ParseUUIDPipe()) returnId: string,
        @Req() request: Request,
        @Res() response: Response,
    ): Promise<void> {
        const { data, status } = await this.proxyService.forward(
            `${this.targetBase}/api/v1/admin/finance/refunds/returns/${returnId}/failure`,
            request,
        );
        response.status(status).json(data);
    }

    // Chuyển tiếp xác nhận hoàn khiếu nại giao hàng đã được admin duyệt.
    @Post('refunds/delivery-issues/:issueId/confirmation')
    @RequirePermissions(Permission.ADMIN_FINANCE_RECONCILE)
    async confirmDeliveryIssueRefund(
        @Param('issueId', new ParseUUIDPipe()) issueId: string,
        @Req() request: Request,
        @Res() response: Response,
    ): Promise<void> {
        const { data, status } = await this.proxyService.forward(
            `${this.targetBase}/api/v1/admin/finance/refunds/delivery-issues/${issueId}/confirmation`,
            request,
        );
        response.status(status).json(data);
    }

    // Lưu lỗi hoàn khiếu nại để giao dịch tiếp tục được xử lý sau khi admin khắc phục nguyên nhân.
    @Post('refunds/delivery-issues/:issueId/failure')
    @RequirePermissions(Permission.ADMIN_FINANCE_RECONCILE)
    async failDeliveryIssueRefund(
        @Param('issueId', new ParseUUIDPipe()) issueId: string,
        @Req() request: Request,
        @Res() response: Response,
    ): Promise<void> {
        const { data, status } = await this.proxyService.forward(
            `${this.targetBase}/api/v1/admin/finance/refunds/delivery-issues/${issueId}/failure`,
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

    // Chuyển tiếp bước chốt giao dịch Pay2S sau khi backend xác nhận candidate và admin xác minh đúng người nhận.
    @Post('withdrawals/:withdrawalId/transfer-confirmation')
    @RequirePermissions(Permission.ADMIN_FINANCE_PAYOUT)
    async confirmWithdrawalTransfer(
        @Param('withdrawalId', new ParseUUIDPipe()) withdrawalId: string,
        @Req() request: Request,
        @Res() response: Response,
    ): Promise<void> {
        const { data, status } = await this.proxyService.forward(
            `${this.targetBase}/api/v1/admin/finance/withdrawals/${withdrawalId}/transfer-confirmation`,
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
}
