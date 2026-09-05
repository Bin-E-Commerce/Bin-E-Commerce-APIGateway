// Module này đăng ký HTTP boundary cho behavioral tracking; Gateway chỉ xác thực context và proxy request.

import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { ProxyService } from "../../common/services/proxy.service";
import { RecommendationProxyController } from "./recommendation-proxy.controller";

@Module({
  imports: [HttpModule],
  controllers: [RecommendationProxyController],
  providers: [ProxyService],
})
export class RecommendationProxyModule {}
