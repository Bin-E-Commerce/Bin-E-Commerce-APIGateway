import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { ProxyService } from "../../common/services/proxy.service";
import { ProductProxyController } from "./product-proxy.controller";

@Module({
  imports: [HttpModule],
  controllers: [ProductProxyController],
  providers: [ProxyService],
})
export class ProductProxyModule {}
