import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { JwksService } from "../services/jwks.service";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwksService: JwksService, // Dùng để xác thực JWT bằng JWKS.
    private readonly reflector: Reflector, // Dùng để đọc metadata từ @Public() decorator.
  ) {}

  // Kiểm tra route public; route còn lại phải có Bearer token hợp lệ để tạo user context.
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException("Missing authorization token");
    }

    try {
      const payload = await this.jwksService.verifyToken(token);

      // Inject user context vào header để proxy và service downstream dùng chung một nguồn phân quyền.
      request.headers["x-user-id"] = payload.sub;
      request.headers["x-user-email"] = payload.email;
      request.headers["x-user-roles"] = (payload.roles ?? []).join(",");
      request.headers["x-user-permissions"] = (payload.permissions ?? []).join(
        ",",
      );
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }

    return true;
  }

  // Trích xuất token từ Authorization header theo định dạng Bearer token.
  private extractToken(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(" ") ?? [];
    return type === "Bearer" ? token : undefined;
  }
}
