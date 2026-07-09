import { All, Controller, ForbiddenException, Req, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Permission } from "@common/auth";
import type { Request, Response } from "express";
import { ProxyService } from "../../common/services/proxy.service";

const READ_ONLY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Proxy khu vực cấu hình phân quyền sang auth-service.
// Controller này tự tách quyền đọc/ghi vì một route proxy bắt nhiều method khác nhau.
@Controller("admin/access-control")
export class AdminAccessControlProxyController {
  private readonly targetBase: string;

  constructor(
    private readonly config: ConfigService,
    private readonly proxyService: ProxyService,
  ) {
    this.targetBase = config.get<string>(
      "AUTH_SERVICE_URL",
      "http://auth-service:3002",
    );
  }

  // Đổi route công khai của Admin Center sang route nội bộ của auth-service.
  // Gateway vẫn là nơi kiểm tra quyền trước, auth-service chỉ nhận request đã có user context.
  @All("*splat")
  async proxy(@Req() req: Request, @Res() res: Response): Promise<void> {
    this.assertAccessControlPermission(req);

    const path = req.path.replace(
      /^\/api\/v1\/admin\/access-control/,
      "/api/v1/auth/access-control",
    );
    const url = `${this.targetBase}${path}`;
    const { data, status } = await this.proxyService.forward(url, req);
    res.status(status).json(data);
  }

  // Tách permission theo loại thao tác để người chỉ có quyền xem không thể bật/tắt role-permission.
  // Auth-service vẫn check lại lần nữa, nên Gateway là lớp chặn sớm chứ không phải điểm bảo vệ duy nhất.
  private assertAccessControlPermission(req: Request): void {
    const permissions = this.parseHeaderList(req.headers["x-user-permissions"]);
    const method = req.method.toUpperCase();

    const requiredPermission =
      READ_ONLY_METHODS.has(method)
        ? Permission.ADMIN_ACCESS_CONTROL_READ
        : Permission.ADMIN_ACCESS_CONTROL_UPDATE;

    if (!permissions.includes(requiredPermission)) {
      throw new ForbiddenException("Insufficient access-control permission");
    }
  }

  // Header permission đi qua HTTP ở dạng chuỗi phân tách dấu phẩy, cần chuẩn hóa trước khi so quyền.
  private parseHeaderList(value: string | string[] | undefined): string[] {
    const raw = Array.isArray(value) ? value.join(",") : value;
    return (raw ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
}
