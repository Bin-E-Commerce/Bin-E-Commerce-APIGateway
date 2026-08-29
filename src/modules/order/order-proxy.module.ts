// File này đăng ký các proxy route của Order Service, không chứa logic tạo đơn.

import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { ProxyService } from "../../common/services/proxy.service";
import { OrderProxyController } from "./order-proxy.controller";

// Module proxy độc lập giúp Gateway tổ chức theo từng domain nghiệp vụ.
@Module({
  imports: [HttpModule],
  controllers: [OrderProxyController],
  providers: [ProxyService],
})
export class OrderProxyModule {}
