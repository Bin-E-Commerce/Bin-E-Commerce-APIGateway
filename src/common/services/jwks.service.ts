import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as jwt from "jsonwebtoken"; // Thư viện để giải mã và xác thực JWT
import jwksClient, { JwksClient } from "jwks-rsa"; // Thư viện để lấy public keys...// Thư viện để lấy public keys từ JWKS endpoint của Keycloak

export interface JwtPayload {
  sub: string; // User ID
  email: string;
  roles: string[];
  iss: string; //Dùng để xác định issuer của token, giúp đảm bảo token được phát hành bởi Keycloak của chúng ta
  exp: number; // Thời gian hết hạn của token, được sử dụng để xác định xem token còn hợp lệ hay không. JwtAuthGuard sẽ dựa vào trường này để từ chối các token đã hết hạn, đảm bảo an toàn cho hệ thống.
  iat: number; // Thời gian phát hành của token, có thể được sử dụng để kiểm tra xem token có quá cũ hay không nếu cần thiết.
}

@Injectable()
export class JwksService implements OnModuleInit {
  private readonly logger = new Logger(JwksService.name);
  private client!: JwksClient; // Client để tương tác với JWKS endpoint của Keycloak
  private readonly expectedIssuer: string; // URL của Keycloak realm, dùng để xác thực issuer trong token

  // Khởi tạo JwksService với ConfigService để lấy cấu hình Keycloak từ environment variables
  constructor(private readonly config: ConfigService) {
    // Xây dựng URL issuer dựa trên cấu hình Keycloak
    const keycloakUrl = config.get<string>(
      "KEYCLOAK_URL",
      "http://localhost:8080",
    );
    //
    const realm = config.get<string>("KEYCLOAK_REALM", "bin-ecommerce");
    this.expectedIssuer = `${keycloakUrl}/realms/${realm}`;
  }

  // Khởi tạo JWKS client khi module được khởi động, thiết lập các tham số như cache và rate limit
  // để tối ưu hiệu suất và tránh quá tải cho Keycloak khi lấy public keys để xác thực JWT
  onModuleInit(): void {
    this.client = jwksClient({
      jwksUri: `${this.expectedIssuer}/protocol/openid-connect/certs`,
      cache: true,
      cacheMaxAge: 3600000, // 1 hour
      rateLimit: true,
      jwksRequestsPerMinute: 10, // Giới hạn số lần request đến JWKS endpoint để tránh quá tải cho Keycloak
    });
    this.logger.log(`JWKS configured for issuer: ${this.expectedIssuer}`);
  }

  // Phương thức để xác thực token bằng cách lấy public key tương ứng từ JWKS endpoint và sử dụng nó để verify token
  // Public key được tạo ra từ Keycloak sẽ được JWKS endpoint cung cấp, và chúng ta sẽ sử dụng nó để xác thực chữ ký của JWT
  // Đảm bảo rằng token là hợp lệ và được phát hành bởi Keycloak của chúng ta
  async verifyToken(token: string): Promise<JwtPayload> {
    const decoded = jwt.decode(token, { complete: true }); // Giải mã token để lấy header và xác định kid (key ID) để tìm public key tương ứng từ JWKS endpoint
    // Kiểm tra cấu trúc token đã hợp lệ chưa, nếu không có header hoặc kid thì token không hợp lệ
    if (!decoded || typeof decoded === "string" || !decoded.header.kid) {
      throw new Error("Invalid token structure");
    }

    // Lấy public key từ JWKS endpoint dựa trên kid trong header của token
    const key = await this.client.getSigningKey(decoded.header.kid);
    const publicKey = key.getPublicKey();

    // Xác thực token bằng public key và kiểm tra issuer để đảm bảo token được phát hành bởi Keycloak của chúng ta
    const payload = jwt.verify(token, publicKey, {
      algorithms: ["RS256"], // Chỉ chấp nhận token được ký bằng thuật toán RS256, đảm bảo tính bảo mật cao hơn so với các thuật toán khác
      issuer: this.expectedIssuer, // Kiểm tra issuer của token để đảm bảo nó được phát hành bởi Keycloak của chúng ta, tránh việc chấp nhận token giả mạo từ các nguồn khác
    }) as JwtPayload;

    // Trả về payload của token đã được xác thực
    return payload;
  }
}
