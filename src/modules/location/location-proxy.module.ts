import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { ProxyService } from "../../common/services/proxy.service";
import { LocationProxyController } from "./location-proxy.controller";

@Module({
  imports: [HttpModule],
  controllers: [LocationProxyController],
  providers: [ProxyService],
})
export class LocationProxyModule {}
