// Decorator này đánh dấu route có thể đi qua khi chưa đăng nhập nhưng vẫn hỗ trợ JWT nếu token có mặt.
// Decorator không tự cấp quyền; nó chỉ cung cấp metadata cho JwtAuthGuard và PermissionsGuard.

import { SetMetadata } from "@nestjs/common";

export const ALLOW_GUEST_KEY = "allow-guest";

// Cho phép guard phân biệt route guest hợp lệ với route bắt buộc phải có access token.
export const AllowGuest = (): MethodDecorator & ClassDecorator =>
  SetMetadata(ALLOW_GUEST_KEY, true);
