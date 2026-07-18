import { Global, Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { JwksService } from "../services/jwks.service";

// SecurityModule gom các provider xác thực dùng chung cho HTTP guard và WebSocket gateway.
// Đánh dấu global giúp mọi module dùng cùng một JwksService và cùng cache public key của Keycloak.
@Global()
@Module({
  imports: [HttpModule.register({ timeout: 30000, maxRedirects: 0 })],
  providers: [JwksService],
  exports: [JwksService],
})
export class SecurityModule {}
