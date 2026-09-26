// Proxy Admin Recommendation tách khỏi public recommendation để permission và upstream boundary dễ audit.

import { Controller, Get, Patch, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Permission } from '@common/auth';
import type { Request, Response } from 'express';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { ProxyService } from '@/common/services/proxy.service';

@Controller('admin/recommendation')
// Gateway bảo vệ các thao tác quản trị recommendation và chuyển tiếp chúng đến Recommendation Service.
// Controller không tự truy vấn analytics hay sửa policy; service đích vẫn kiểm tra lại quyền ở boundary của nó.
export class AdminRecommendationProxyController {
    private readonly targetBase: string;
    private readonly internalServiceToken: string;

    // Đọc địa chỉ upstream và internal token một lần khi khởi tạo; bỏ slash cuối URL để ghép path nhất quán.
    // Nếu token chưa cấu hình, proxy không tự tạo token giả mà để upstream từ chối request nội bộ.
    constructor(
        config: ConfigService,
        private readonly proxyService: ProxyService,
    ) {
        this.targetBase = config
            .get<string>('RECOMMENDATION_SERVICE_URL', 'http://localhost:3006')
            .replace(/\/$/, '');
        this.internalServiceToken = config.get<string>(
            'INTERNAL_SERVICE_TOKEN',
            '',
        );
    }

    // Đọc KPI recommendation trong khoảng ngày mà Admin gửi qua query string.
    // Chỉ Admin có quyền analytics-read được gọi; status và dữ liệu upstream được trả nguyên trạng về client.
    @Get('overview')
    @RequirePermissions(Permission.ADMIN_RECOMMENDATION_ANALYTICS_READ)
    async overview(@Req() req: Request, @Res() res: Response): Promise<void> {
        await this.forward(req, res);
    }

    // Tìm các user/guest session có hoạt động, kèm bộ lọc, tìm kiếm và phân trang trong query string.
    // Quyền analytics-read được kiểm tra tại Gateway trước khi chuyển request sang Recommendation Service.
    @Get('users')
    @RequirePermissions(Permission.ADMIN_RECOMMENDATION_ANALYTICS_READ)
    async users(@Req() req: Request, @Res() res: Response): Promise<void> {
        await this.forward(req, res);
    }

    // Lấy các event recommendation của userId trên URL; query ngày và phân trang được giữ nguyên khi proxy.
    // Endpoint chỉ dành cho Admin có quyền analytics-read, không dùng để xem activity của guest session.
    @Get('users/:userId/activity')
    @RequirePermissions(Permission.ADMIN_RECOMMENDATION_ANALYTICS_READ)
    async userActivity(
        @Req() req: Request,
        @Res() res: Response,
    ): Promise<void> {
        await this.forward(req, res);
    }

    // Đọc policy ranking đang chạy, gồm trọng số Standard Ranking và cấu hình AI-Enhanced Ranking.
    // Quyền policy-read được xác thực ở Gateway; controller chỉ chuyển tiếp và trả kết quả upstream.
    @Get('config')
    @RequirePermissions(Permission.ADMIN_RECOMMENDATION_POLICY_READ)
    async getConfig(@Req() req: Request, @Res() res: Response): Promise<void> {
        await this.forward(req, res);
    }

    // Gửi phần policy Admin muốn cập nhật trong body, chẳng hạn hybridWeights, mlEnabled hoặc mlBlend.
    // Chỉ quyền policy-write được phép; Recommendation Service chịu trách nhiệm validate, lưu version và áp dụng policy.
    @Patch('config')
    @RequirePermissions(Permission.ADMIN_RECOMMENDATION_POLICY_WRITE)
    async updateConfig(
        @Req() req: Request,
        @Res() res: Response,
    ): Promise<void> {
        await this.forward(req, res);
    }

    // Đọc danh sách phiên bản policy và metadata audit để Admin kiểm tra các lần thay đổi trước đó.
    // Đây là thao tác chỉ đọc, yêu cầu quyền policy-read và không làm thay đổi cấu hình đang chạy.
    @Get('config/history')
    @RequirePermissions(Permission.ADMIN_RECOMMENDATION_POLICY_READ)
    async configHistory(
        @Req() req: Request,
        @Res() res: Response,
    ): Promise<void> {
        await this.forward(req, res);
    }

    // Yêu cầu khôi phục policy theo version trên URL; service đích tạo version rollback mới thay vì sửa lịch sử cũ.
    // Chỉ quyền policy-rollback được phép; response/status từ Recommendation Service được giữ nguyên.
    @Post('config/rollback/:version')
    @RequirePermissions(Permission.ADMIN_RECOMMENDATION_POLICY_ROLLBACK)
    async rollback(@Req() req: Request, @Res() res: Response): Promise<void> {
        await this.forward(req, res);
    }

    // Đọc số liệu attribution tổng hợp theo experiment/variant trong khoảng ngày được truyền qua query string.
    // Cần quyền analytics-read; dữ liệu rỗng có thể có nghĩa là chưa phát sinh event đủ điều kiện trong khoảng đó.
    @Get('experiments')
    @RequirePermissions(Permission.ADMIN_RECOMMENDATION_ANALYTICS_READ)
    async experiments(
        @Req() req: Request,
        @Res() res: Response,
    ): Promise<void> {
        await this.forward(req, res);
    }

    // Chuyển tiếp nguyên HTTP method, body, query và user context đã được Gateway xác thực đến Recommendation Service.
    // Chèn internal token từ cấu hình Gateway (không tin token do client gửi), sau đó trả status/body upstream về client.
    // Lỗi HTTP từ upstream được giữ nguyên; nếu upstream không thể kết nối, ProxyService trả Service Unavailable.
    private async forward(req: Request, res: Response): Promise<void> {
        const path = req.path.replace(
            /^\/api\/v1\/admin\/recommendation/,
            '/api/v1/admin/recommendation',
        );
        // ProxyService đã forward req.query qua Axios params; không nối query string
        // thêm lần nữa để tránh upstream nhận duplicate page/from/to/search.
        const { data, status } = await this.proxyService.forward(
            `${this.targetBase}${path}`,
            req,
            this.internalServiceToken
                ? { 'x-internal-service-token': this.internalServiceToken }
                : {},
        );
        res.status(status).json(data);
    }
}
