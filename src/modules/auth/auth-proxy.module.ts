import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { AuthProxyController } from "./auth-proxy.controller";
import { UsersProxyController } from "./users-proxy.controller";
import { AdminUsersProxyController } from "./admin-users-proxy.controller";
import { AdminAccessControlProxyController } from "./admin-access-control-proxy.controller";
import { ProxyService } from "../../common/services/proxy.service";

@Module({
  imports: [HttpModule],
  controllers: [
    AuthProxyController,
    UsersProxyController,
    AdminAccessControlProxyController,
    AdminUsersProxyController,
  ],
  providers: [ProxyService],
})
export class AuthProxyModule {}
