import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import * as jwt from "jsonwebtoken";
import jwksClient, { JwksClient } from "jwks-rsa";
import { firstValueFrom } from "rxjs";
import { normalizeBusinessRoles, Permission } from "@common/auth";

interface KeycloakAccessTokenPayload extends jwt.JwtPayload {
  email?: string;
  name?: string;
  preferred_username?: string;
  picture?: string;
  avatar_url?: string;
  roles?: string[];
  realm_access?: {
    roles?: string[];
  };
  resource_access?: Record<
    string,
    {
      roles?: string[];
    }
  >;
}

interface AuthViewerResponse {
  data?: {
    permissions?: Permission[];
    name?: string;
    avatarUrl?: string | null;
  };
}

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  roles: string[];
  permissions: Permission[];
  iss: string;
  exp: number;
  iat: number;
}

@Injectable()
export class JwksService implements OnModuleInit {
  private readonly logger = new Logger(JwksService.name);
  private client!: JwksClient;
  private readonly expectedIssuer: string;
  private readonly authServiceUrl: string;

  // Khởi tạo issuer Keycloak và URL auth-service để Gateway xác thực token rồi lấy permission động từ backend.
  constructor(
    private readonly config: ConfigService,
    private readonly httpService: HttpService,
  ) {
    const keycloakUrl = config.get<string>(
      "KEYCLOAK_URL",
      "http://localhost:8080",
    );
    const realm = config.get<string>("KEYCLOAK_REALM", "bin-ecommerce");
    this.expectedIssuer = `${keycloakUrl}/realms/${realm}`;
    this.authServiceUrl = config.get<string>(
      "AUTH_SERVICE_URL",
      "http://auth-service:3002",
    );
  }

  // Tạo JWKS client một lần khi module boot để cache public keys xác thực JWT.
  onModuleInit(): void {
    this.client = jwksClient({
      jwksUri: `${this.expectedIssuer}/protocol/openid-connect/certs`,
      cache: true,
      cacheMaxAge: 3600000,
      rateLimit: true,
      jwksRequestsPerMinute: 10,
    });
    this.logger.log(`JWKS configured for issuer: ${this.expectedIssuer}`);
  }

  // Xác thực chữ ký JWT bằng public key Keycloak, sau đó lấy permissions động từ Auth Service.
  async verifyToken(token: string): Promise<JwtPayload> {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded === "string" || !decoded.header.kid) {
      throw new Error("Invalid token structure");
    }

    const key = await this.client.getSigningKey(decoded.header.kid);
    const publicKey = key.getPublicKey();
    const payload = jwt.verify(token, publicKey, {
      algorithms: ["RS256"],
      issuer: this.expectedIssuer,
    }) as KeycloakAccessTokenPayload;
    const roles = this.extractRoles(payload);
    const userId = payload.sub ?? "";
    const viewer = await this.resolveDynamicViewer(userId, roles);

    return {
      sub: userId,
      email: payload.email ?? "",
      name:
        viewer.name ??
        payload.name ??
        payload.preferred_username ??
        payload.email?.split("@")[0] ??
        "",
      avatarUrl: viewer.avatarUrl ?? payload.picture ?? payload.avatar_url ?? null,
      roles,
      permissions: viewer.permissions ?? [],
      iss: payload.iss ?? "",
      exp: payload.exp ?? 0,
      iat: payload.iat ?? 0,
    };
  }

  // Lấy viewer từ Auth Service để dùng permission và profile chính thức thay vì tự derive cứng trong Gateway.
  // Auth Service dùng Redis cache access profile nên role-permission đổi trong DB sẽ có hiệu lực sau khi cache bị xóa.
  private async resolveDynamicViewer(
    userId: string,
    roles: string[],
  ): Promise<NonNullable<AuthViewerResponse["data"]>> {
    if (!userId) return { permissions: [] };

    const response = await firstValueFrom(
      this.httpService.get<AuthViewerResponse>(
        `${this.authServiceUrl}/api/v1/auth/me`,
        {
          headers: {
            "x-user-id": userId,
            "x-user-roles": roles.join(","),
          },
        },
      ),
    );

    return response.data.data ?? { permissions: [] };
  }

  // Lấy role từ mọi claim Keycloak, chỉ giữ role nghiệp vụ và bỏ CUSTOMER nếu đã có role cao hơn.
  private extractRoles(payload: KeycloakAccessTokenPayload): string[] {
    const rawRoles = [
      ...(payload.roles ?? []),
      ...(payload.realm_access?.roles ?? []),
      ...Object.values(payload.resource_access ?? {}).flatMap(
        (access) => access.roles ?? [],
      ),
    ];

    return normalizeBusinessRoles(rawRoles);
  }
}
