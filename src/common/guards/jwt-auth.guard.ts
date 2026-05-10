import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { JwksService } from "../services/jwks.service";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwksService: JwksService, // Dùng để xác thực JWT bằng JWKS
    private readonly reflector: Reflector, // Dùng để đọc metadata từ @Public() decorator
  ) {}

  // Kiểm tra xem route có được đánh dấu là @Public() hay không, nếu có thì bỏ qua JWT check
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Skip JWT check for @Public() routes
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // Nếu không phải public, thực hiện kiểm tra JWT
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException("Missing authorization token");
    }

    // Xác thực token và inject user context vào header để forward downstream
    try {
      // Nếu token hợp lệ, payload sẽ chứa thông tin người dùng như sub, email, roles, v.v.
      const payload = await this.jwksService.verifyToken(token);

      // Inject thông tin người dùng vào header để các service downstream có thể sử dụng
      request.headers["x-user-id"] = payload.sub;
      request.headers["x-user-email"] = payload.email;
      request.headers["x-user-roles"] = (payload.roles ?? []).join(",");
    } catch {
      // Nếu token không hợp lệ hoặc hết hạn, trả về lỗi 401 Unauthorized
      throw new UnauthorizedException("Invalid or expired token");
    }

    return true;
  }

  // Trích xuất token từ header Authorization theo định
  private extractToken(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(" ") ?? [];
    return type === "Bearer" ? token : undefined;
  }
}
