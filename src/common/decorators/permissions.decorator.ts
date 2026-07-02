import { SetMetadata } from "@nestjs/common";
import { Permission } from "@common/auth";

export const PERMISSIONS_KEY = "permissions";

// Gắn danh sách quyền thao tác cần có cho route, tách khỏi role để dễ mở rộng RBAC/ABAC sau này.
// Dùng decorator này ngay trên controller method để quyền nằm sát endpoint, không gom 1000 endpoint vào một file map khổng lồ.
export const RequirePermissions = (
  ...permissions: Permission[]
): MethodDecorator & ClassDecorator =>
  SetMetadata(PERMISSIONS_KEY, permissions);

// Alias giữ tương thích với code cũ; endpoint mới nên dùng @RequirePermissions để đọc rõ nghĩa hơn.
export const Permissions = RequirePermissions;
