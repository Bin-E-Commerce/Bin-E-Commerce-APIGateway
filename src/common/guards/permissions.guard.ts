import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { Permission } from "@common/auth";
import { ALLOW_GUEST_KEY } from "../decorators/allow-guest.decorator";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";

// Guard này kiểm tra permission khi route yêu cầu; Guest chỉ được đi qua route đã khai báo AllowGuest.
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  // Kiểm tra quyền thao tác ở API Gateway để chặn sớm trước khi request đi vào service nội bộ.
  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredPermissions || requiredPermissions.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const allowGuest = this.reflector.getAllAndOverride<boolean>(
      ALLOW_GUEST_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowGuest && !request.headers["x-user-id"]) return true;

    const userPermissions = this.parseHeaderList(
      request.headers["x-user-permissions"],
    );

    // Route có @RequirePermissions() phải có ít nhất một permission tương ứng trong token context.
    // Quyền được lấy từ JWT guard qua x-user-permissions, nên service phía sau nhận cùng context đã kiểm tra.
    const allowed = requiredPermissions.some((permission) =>
      userPermissions.includes(permission),
    );
    if (!allowed) {
      throw new ForbiddenException("Insufficient permissions");
    }

    return true;
  }

  // Header qua HTTP chỉ là chuỗi, nên chuẩn hóa về mảng để guard không phụ thuộc format raw.
  private parseHeaderList(value: string | string[] | undefined): string[] {
    const raw = Array.isArray(value) ? value.join(",") : value;
    return (raw ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
}
