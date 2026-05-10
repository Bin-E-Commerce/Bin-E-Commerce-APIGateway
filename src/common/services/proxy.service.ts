// Module này cung cấp dịch vụ proxy để chuyển tiếp các request từ API Gateway đến các microservices khác trong hệ thống
// Nó sử dụng HttpService của NestJS để thực hiện các request HTTP và xử lý lỗi một cách hiệu quả, đảm bảo rằng các lỗi từ upstream service được trả về đúng cách cho client
// Dịch vụ này cũng đảm bảo rằng các header cần thiết như thông tin người dùng được inject từ JWT guard sẽ được forward đến các service downstream
// Lý do đặt tên là ProxyService vì nó đóng vai trò như một proxy để chuyển tiếp các request, giúp tách biệt logic của API Gateway với các microservices khác
// và đảm bảo rằng các lỗi được xử lý một cách nhất quán

import {
  Injectable,
  Logger,
  HttpException,
  InternalServerErrorException,
} from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { AxiosError, AxiosRequestConfig } from "axios";
import type { Request } from "express";
import { firstValueFrom } from "rxjs";

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);

  // Khởi tạo ProxyService với HttpService để thực hiện các request HTTP đến các microservices khác
  constructor(private readonly httpService: HttpService) {}

  // Phương thức chính để forward request đến targetUrl
  // Xây dựng cấu hình request dựa trên request gốc
  // Và xử lý response cũng như lỗi một cách hiệu quả
  // Mục đích hàm này là để chuyển tiếp request từ API Gateway đến các microservices khác
  // Đồng thời đảm bảo rằng các lỗi từ upstream service được trả về đúng cách cho client
  async forward(
    targetUrl: string,
    req: Request,
  ): Promise<{
    data: unknown;
    status: number;
    headers: Record<string, string | string[]>;
  }> {
    const config: AxiosRequestConfig = {
      method: req.method as AxiosRequestConfig["method"],
      url: targetUrl,
      data: req.body,
      headers: this.buildForwardHeaders(req), // Xây dựng header để forward, bao gồm cả thông tin người dùng được inject từ JWT guard
      params: req.query, // Forward query parameters, ví dụ như ?page=1&limit=10
      validateStatus: () => true, // Cho phép xử lý tất cả các status code trong response, không tự động throw lỗi cho status >= 400 để chúng ta có thể trả về đúng lỗi từ upstream service cho client
    };

    try {
      // Thực hiện request đến targetUrl bằng HttpService và chờ response
      const response = await firstValueFrom(this.httpService.request(config));
      return {
        data: response.data as unknown,
        status: response.status,
        headers: response.headers as Record<string, string | string[]>,
      };
    } catch (err) {
      // Xử lý lỗi từ request đến targetUrl, log lỗi và trả về lỗi phù hợp cho client
      const axiosErr = err as AxiosError;
      this.logger.error(`Proxy error to ${targetUrl}: ${axiosErr.message}`);

      if (axiosErr.response) {
        throw new HttpException(
          axiosErr.response.data as object,
          axiosErr.response.status,
        );
      }

      // Nếu không có response từ upstream (ví dụ: network error), trả về lỗi 503 Service Unavailable
      throw new InternalServerErrorException("Upstream service unavailable");
    }
  }

  // Xây dựng header để forward, bao gồm cả thông tin người dùng được inject từ JWT guard
  // Dùng để đảm bảo rằng các service downstream có thể nhận được thông tin người dùng (user context) để thực hiện authorization hoặc logging nếu cần thiết
  private buildForwardHeaders(req: Request): Record<string, string> {
    const forward: Record<string, string> = {};

    // Forward injected user context headers from JWT guard
    const ctxHeaders = ["x-user-id", "x-user-email", "x-user-roles"];
    for (const h of ctxHeaders) {
      const val = req.headers[h];
      if (val) forward[h] = String(val);
    }

    // Forward content-type nếu có, để đảm bảo downstream service có thể parse body đúng cách
    // content-type thường là application/json cho các request API, nhưng cũng có thể là multipart/form-data hoặc các loại khác tùy vào endpoint
    if (req.headers["content-type"]) {
      forward["content-type"] = req.headers["content-type"];
    }

    // Forward cookie nếu có, để đảm bảo downstream service có thể nhận được session hoặc thông tin xác thực nếu cần thiết
    // Dùng cho các trường hợp auth-service sử dụng httpOnly cookies để quản lý session
    // Khi đó chúng ta cần forward cookie từ client đến auth-service để auth-service có thể xác thực người dùng
    if (req.headers["cookie"]) {
      forward["cookie"] = req.headers["cookie"];
    }

    // Forward IP address để downstream service có thể biết được IP gốc của client, hữu ích cho logging hoặc rate limiting
    const ip = req.headers["x-forwarded-for"] ?? req.socket.remoteAddress;
    if (ip) forward["x-forwarded-for"] = String(ip);

    return forward;
  }
}
