import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { AuthProxyController } from "./controllers/auth/auth-proxy.controller";
import { UsersProxyController } from "./controllers/users/users-proxy.controller";
import { AdminUsersProxyController } from "./controllers/admin/admin-users-proxy.controller";
import { AdminAccessControlProxyController } from "./controllers/admin/admin-access-control-proxy.controller";
import { ProxyService } from "../../common/services/proxy.service";
import { AdminRoleGuard } from "../../common/guards/admin-role.guard";

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
