import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AuthProxyController } from '@/modules/auth/controllers/auth/auth-proxy.controller';
import { UsersProxyController } from '@/modules/auth/controllers/users/users-proxy.controller';
import { AdminUsersProxyController } from '@/modules/auth/controllers/admin/admin-users-proxy.controller';
import { AdminAccessControlProxyController } from '@/modules/auth/controllers/admin/admin-access-control-proxy.controller';
import { ProxyService } from '@/common/services/proxy.service';
import { AdminRoleGuard } from '@/common/guards/admin-role.guard';

@Module({
    imports: [HttpModule],
    controllers: [
        AuthProxyController,
        UsersProxyController,
        AdminAccessControlProxyController,
        AdminUsersProxyController,
    ],
    providers: [ProxyService, AdminRoleGuard],
})
export class AuthProxyModule {}
