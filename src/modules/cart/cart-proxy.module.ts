// Module này đăng ký các route Gateway của Cart Service.
// Module chỉ proxy HTTP, không chứa query cart hay business rule của Cart bounded context.

import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { ProxyService } from "../../common/services/proxy.service";
import { CartProxyController } from "./cart-proxy.controller";

// Đóng gói controller proxy và Http client theo đúng cấu trúc các domain Gateway khác.
@Module({
  imports: [HttpModule],
  controllers: [CartProxyController],
  providers: [ProxyService],
})
export class CartProxyModule {}
