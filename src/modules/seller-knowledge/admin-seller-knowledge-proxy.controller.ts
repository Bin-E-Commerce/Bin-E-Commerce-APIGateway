import { Controller, Get, Patch, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Permission } from '@common/auth';
import type { Request, Response } from 'express';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { ProxyService } from '@/common/services/proxy.service';

// Gateway xác thực người dùng và quyền theo từng thao tác trước khi chuyển tiếp API quản trị tri thức.
// Controller không tự xử lý dữ liệu Seller Knowledge; Seller Service là nơi thực hiện nghiệp vụ và trả kết quả.
// Internal token luôn lấy từ cấu hình server, tuyệt đối không nhận từ header do browser gửi lên.
@Controller('admin/seller-knowledge')
export class AdminSellerKnowledgeProxyController {
    private readonly targetBase: string;
    private readonly internalToken: string;

    constructor(
        config: ConfigService,
        private readonly proxy: ProxyService,
    ) {
        // Chuẩn hóa URL để nối route không tạo dấu slash kép; dùng service URL nội bộ làm fallback trong Docker.
        this.targetBase = config
            .get<string>('SELLER_SERVICE_URL', 'http://seller-service:3007')
            .replace(/\/$/u, '');
        // Token xác thực service-to-service do Gateway quản lý, không phụ thuộc thông tin client gửi.
        this.internalToken = config.get<string>('INTERNAL_SERVICE_TOKEN', '');
    }

    // GET /admin/seller-knowledge/documents trả danh sách tài liệu theo query filter từ Seller Service.
    // Chỉ cần quyền đọc; các query như search, domain và status được ProxyService chuyển tiếp nguyên trạng.
    @Get('documents')
    @RequirePermissions(Permission.ADMIN_SELLER_KNOWLEDGE_READ)
    async documents(@Req() req: Request, @Res() res: Response): Promise<void> {
        await this.forward(req, res);
    }

    // GET /admin/seller-knowledge/domains lấy registry nhóm để UI hiển thị nhãn và lựa chọn phân loại.
    // Đây là thao tác chỉ đọc, không cấp ngầm quyền tạo nhóm hoặc thay đổi trạng thái nhóm.
    @Get('domains')
    @RequirePermissions(Permission.ADMIN_SELLER_KNOWLEDGE_READ)
    async domains(@Req() req: Request, @Res() res: Response): Promise<void> {
        await this.forward(req, res);
    }

    // POST /admin/seller-knowledge/domains đăng ký nhóm nội dung mới qua Seller Service.
    // Quyền quản lý domain tách khỏi quyền sửa tài liệu; backend tiếp tục giới hạn nhóm được phép tạo.
    @Post('domains')
    @RequirePermissions(Permission.ADMIN_SELLER_KNOWLEDGE_DOMAIN_MANAGE)
    async createDomain(
        @Req() req: Request,
        @Res() res: Response,
    ): Promise<void> {
        await this.forward(req, res);
    }

    // PATCH /admin/seller-knowledge/domains/:code/:status đổi trạng thái nhóm theo mã và trạng thái trên path.
    // Yêu cầu quyền quản lý domain; Seller Service chịu trách nhiệm xác thực trạng thái hợp lệ và điều kiện kích hoạt.
    @Patch('domains/:code/:status')
    @RequirePermissions(Permission.ADMIN_SELLER_KNOWLEDGE_DOMAIN_MANAGE)
    async updateDomain(
        @Req() req: Request,
        @Res() res: Response,
    ): Promise<void> {
        await this.forward(req, res);
    }

    // POST /admin/seller-knowledge/documents tạo tài liệu cùng revision khởi tạo ở trạng thái nháp.
    // Chỉ quyền write được phép gửi metadata/nội dung; publish và rollback có endpoint cùng quyền riêng.
    @Post('documents')
    @RequirePermissions(Permission.ADMIN_SELLER_KNOWLEDGE_WRITE)
    async createDocument(
        @Req() req: Request,
        @Res() res: Response,
    ): Promise<void> {
        await this.forward(req, res);
    }

    // GET /admin/seller-knowledge/documents/:id lấy metadata và lịch sử revision để mở trang chi tiết.
    // Endpoint chỉ đọc nên không cho phép thay đổi nội dung dù response có chứa thông tin revision.
    @Get('documents/:id')
    @RequirePermissions(Permission.ADMIN_SELLER_KNOWLEDGE_READ)
    async document(@Req() req: Request, @Res() res: Response): Promise<void> {
        await this.forward(req, res);
    }

    // POST /admin/seller-knowledge/documents/:id/archive lưu trữ tài liệu nhưng không xóa lịch sử revision.
    // Đây là thay đổi trạng thái dữ liệu nên yêu cầu write permission, không dùng quyền read.
    @Post('documents/:id/archive')
    @RequirePermissions(Permission.ADMIN_SELLER_KNOWLEDGE_WRITE)
    async archiveDocument(
        @Req() req: Request,
        @Res() res: Response,
    ): Promise<void> {
        await this.forward(req, res);
    }

    // POST /admin/seller-knowledge/documents/:id/revisions tạo revision nháp mới từ nội dung admin gửi.
    // Revision đã xuất bản được giữ nguyên; việc ghi nội dung mới chỉ cần quyền write, chưa tự publish.
    @Post('documents/:id/revisions')
    @RequirePermissions(Permission.ADMIN_SELLER_KNOWLEDGE_WRITE)
    async createRevision(
        @Req() req: Request,
        @Res() res: Response,
    ): Promise<void> {
        await this.forward(req, res);
    }

    // GET /admin/seller-knowledge/revisions/:revisionId/preview xem Markdown/chunk và lỗi validation của revision.
    // Preview không xuất bản nội dung và chỉ dùng quyền read để phục vụ bước kiểm tra trước khi publish.
    @Get('revisions/:revisionId/preview')
    @RequirePermissions(Permission.ADMIN_SELLER_KNOWLEDGE_READ)
    async preview(@Req() req: Request, @Res() res: Response): Promise<void> {
        await this.forward(req, res);
    }

    // POST /admin/seller-knowledge/revisions/:revisionId/test-query chạy câu hỏi thử trên revision được chọn.
    // Kết quả chỉ phục vụ kiểm tra khả năng truy xuất; endpoint không thay đổi revision hay trạng thái tài liệu.
    @Post('revisions/:revisionId/test-query')
    @RequirePermissions(Permission.ADMIN_SELLER_KNOWLEDGE_READ)
    async testQuery(@Req() req: Request, @Res() res: Response): Promise<void> {
        await this.forward(req, res);
    }

    // POST /admin/seller-knowledge/revisions/:revisionId/publish yêu cầu Seller Service kiểm tra và phát hành revision.
    // Tách quyền publish khỏi write để người chỉ soạn nội dung không thể tự đưa dữ liệu vào kho truy xuất.
    @Post('revisions/:revisionId/publish')
    @RequirePermissions(Permission.ADMIN_SELLER_KNOWLEDGE_PUBLISH)
    async publish(@Req() req: Request, @Res() res: Response): Promise<void> {
        await this.forward(req, res);
    }

    // POST /admin/seller-knowledge/documents/:id/rollback/:revisionId khôi phục nội dung từ revision được chọn.
    // Chỉ quyền rollback được phép gọi; Seller Service giữ lịch sử bằng cách tạo bản phát hành khôi phục mới.
    @Post('documents/:id/rollback/:revisionId')
    @RequirePermissions(Permission.ADMIN_SELLER_KNOWLEDGE_ROLLBACK)
    async rollback(@Req() req: Request, @Res() res: Response): Promise<void> {
        await this.forward(req, res);
    }

    // Ghép service URL với path gốc để giữ đúng route; ProxyService chuyển method, query, body và user context đã qua JWT.
    // Internal token được thêm từ cấu hình Gateway, sau đó trả nguyên status/body upstream để không làm sai kết quả nghiệp vụ.
    // Lỗi kết nối hoặc phản hồi upstream được ProxyService phân loại; controller không tự đổi mã lỗi.
    private async forward(req: Request, res: Response): Promise<void> {
        const target = `${this.targetBase}${req.path}`;
        const { data, status } = await this.proxy.forward(target, req, {
            'x-internal-service-token': this.internalToken,
        });
        res.status(status).json(data);
    }
}
