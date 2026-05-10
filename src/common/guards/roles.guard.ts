import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core"; // Thư viện để đọc metadata từ decorators như @Roles() và @Public()
import type { Request } from "express";
import { UserRole } from "@common/enums/user-role.enum";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

// File mục đích dùng đẻ kiểm tra xem người dùng có đủ quyền (roles) để truy cập vào một route hay không
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  // Kiểm tra xem route có được đánh dấu là @Public() hay không, nếu có thì bỏ qua role check
  canActivate(context: ExecutionContext): boolean {
    // Skip for @Public() routes (JwtAuthGuard already bypassed them)
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // Lấy danh sách roles được yêu cầu từ @Roles() decorator
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Nếu không có roles nào được yêu cầu, cho phép truy cập
    if (!requiredRoles || requiredRoles.length === 0) return true;

    // Lấy thông tin roles của người dùng từ header (được JwtAuthGuard inject vào)
    const request = context.switchToHttp().getRequest<Request>();
    const rolesHeader = request.headers["x-user-roles"] as string | undefined;

    // Nếu không có thông tin roles trong header, trả về lỗi 403 Forbidden
    if (!rolesHeader)
      throw new ForbiddenException("Missing user roles context");

    // Chuyển đổi chuỗi roles thành mảng để kiểm tra
    const userRoles = rolesHeader.split(",").map((r) => r.trim());

    // Nếu người dùng có role ADMIN, cho phép truy cập mà không cần kiểm tra thêm
    if (userRoles.includes(UserRole.ADMIN)) return true;

    // Kiểm tra xem người dùng có ít nhất một trong các role được yêu cầu hay không
    const hasRequiredRole = requiredRoles.some((r) => userRoles.includes(r));
    if (!hasRequiredRole) {
      throw new ForbiddenException("Insufficient permissions");
    }

    return true;
  }
}
