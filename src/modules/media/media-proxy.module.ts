import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { ProxyService } from "../../common/services/proxy.service";
import { MediaProxyController } from "./media-proxy.controller";

@Module({
  imports: [HttpModule],
  controllers: [MediaProxyController],
  providers: [ProxyService],
})
export class MediaProxyModule {}
