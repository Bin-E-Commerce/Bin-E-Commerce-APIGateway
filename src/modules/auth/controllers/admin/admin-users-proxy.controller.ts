import { All, Controller, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { Permission } from '@common/auth';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { ProxyService } from '@/common/services/proxy.service';
import { AdminRoleGuard } from '@/common/guards/admin-role.guard';

// Proxy các request quản lý người dùng sang auth-service.
// Đây là vùng quản trị rộng nên khóa bằng admin.access thay vì role SUPPORT_AGENT.

@Controller('admin/users')
@RequirePermissions(Permission.ADMIN_ACCESS)
@UseGuards(AdminRoleGuard)
export class AdminUsersProxyController {
    private readonly targetBase: string;

    constructor(
        private readonly config: ConfigService,
        private readonly proxyService: ProxyService,
    ) {
        this.targetBase = config.get<string>(
            'AUTH_SERVICE_URL',
            'http://auth-service:3002',
        );
    }

    // Route collection dùng handler riêng vì NestJS không giữ được hai route decorator trên cùng một method.
    @All()
    async proxyCollection(
        @Req() req: Request,
        @Res() res: Response,
    ): Promise<void> {
        await this.forward(req, res);
    }

    // Wildcard nhận các route chi tiết như `/:id`, `/:id/sessions` và `/:id/audit`.
    // Tách handler giúp RouterExplorer map route rõ ràng, tránh 404 trước khi request được forward.
    @All('*splat')
    async proxyNested(
        @Req() req: Request,
        @Res() res: Response,
    ): Promise<void> {
        await this.forward(req, res);
    }

    // Chuẩn hóa đường dẫn Gateway về đúng HTTP boundary của auth-service và giữ nguyên method, query, body, identity header.
    // Hàm này không tự authorize lại; AdminRoleGuard và auth-service chịu trách nhiệm kiểm tra ADMIN trước khi xử lý.
    private async forward(req: Request, res: Response): Promise<void> {
        const path = req.path.replace(/^\/api/, '');
        const url = `${this.targetBase}/api${path}`;
        const { data, status } = await this.proxyService.forward(url, req);
        res.status(status).json(data);
    }
}
