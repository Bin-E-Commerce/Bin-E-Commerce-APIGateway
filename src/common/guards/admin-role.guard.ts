import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { UserRole } from '@common/enums/user-role.enum';

// Guard riêng cho user-management; ADMIN_ACCESS vẫn mở Admin Center nhưng không đủ để quản lý tài khoản.
@Injectable()
export class AdminRoleGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<Request>();
        const header = request.headers['x-user-roles'];
        const roles = (
            Array.isArray(header) ? header.join(',') : (header ?? '')
        )
            .split(',')
            .map((role) => role.trim());
        if (!roles.includes(UserRole.ADMIN))
            throw new ForbiddenException('Chỉ ADMIN được quản lý user');
        return true;
    }
}
