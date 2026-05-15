import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { SKIP_CSRF_KEY } from "../decorators/skip-csrf.decorator";

// Bảo vệ CSRF cho các state-changing request (POST / PUT / PATCH / DELETE).
// Cơ chế: Custom Request Header — trình duyệt không cho phép trang web khác domain
// tự ý gắn header X-Requested-With vào cross-site request.
// CORS + SameSite=Lax cookie là lớp bảo vệ chính; guard này là lớp defense-in-depth.
// FE (publicAxios / authorizedAxios) phải gửi header `X-Requested-With: XMLHttpRequest`.
@Injectable()
export class CsrfGuard implements CanActivate {
  private static readonly SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();

    // Safe methods không thay đổi trạng thái → không cần CSRF check
    if (CsrfGuard.SAFE_METHODS.has(req.method)) return true;

    // @SkipCsrf() — bỏ qua cho các route đặc biệt
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    // Kiểm tra header custom do FE gửi lên để xác nhận request này là same-site
    const header = req.headers["x-requested-with"];
    if (header !== "XMLHttpRequest") {
      throw new ForbiddenException(
        "CSRF validation failed: X-Requested-With header required",
      );
    }

    return true;
  }
}
