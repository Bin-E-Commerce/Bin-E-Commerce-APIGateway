// Module proxy public shop và các mutation follow.
// Gateway chỉ lo auth/permission và chuyển tiếp request; nghiệp vụ counter nằm ở Seller Service.

import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { ProxyService } from "../../common/services/proxy.service";
import { ShopProxyController } from "./shop-proxy.controller";

// Module wiring riêng cho public shop để proxy controller không trộn với Product/Seller Center routes.
@Module({
  imports: [HttpModule],
  controllers: [ShopProxyController],
  providers: [ProxyService],
})
export class ShopProxyModule {}
