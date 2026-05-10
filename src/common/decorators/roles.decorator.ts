import { SetMetadata } from "@nestjs/common";
import { UserRole } from "@common/enums/user-role.enum";

export const ROLES_KEY = "roles";

// Dùng để chỉ định các vai trò (roles) được phép truy cập vào một route hoặc controller
// Cách sử dụng: @Roles(UserRole.Admin, UserRole.User) sẽ cho phép cả Admin và User truy cập
export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
