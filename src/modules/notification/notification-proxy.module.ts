import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { ProxyService } from "../../common/services/proxy.service";
import { NotificationProxyController } from "./notification-proxy.controller";

@Module({
  imports: [HttpModule],
  controllers: [NotificationProxyController],
  providers: [ProxyService],
})
export class NotificationProxyModule {}
