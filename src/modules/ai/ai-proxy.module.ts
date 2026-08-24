// File này đăng ký module proxy AI độc lập để các route AI có thể mở rộng mà không làm phình ProductProxyModule.
// Module chỉ chứa HTTP adapter dùng chung; nghiệp vụ AI vẫn được triển khai trong ai-service Python.

import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { ProxyService } from "../../common/services/proxy.service";
import { AiProxyController } from "./ai-proxy.controller";

@Module({
  imports: [HttpModule],
  controllers: [AiProxyController],
  providers: [ProxyService],
})
export class AiProxyModule {}
