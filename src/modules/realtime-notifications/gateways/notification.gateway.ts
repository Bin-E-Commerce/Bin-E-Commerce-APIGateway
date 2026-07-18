import {
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Namespace, Socket } from "socket.io";
import {
  NotificationAudience,
  NotificationAudienceType,
  NotificationRealtimeMessage,
} from "@common/notifications";
import { JwksService } from "../../../common/services/jwks.service";
import { NotificationRealtimeSubscriberService } from "../services/notification-realtime-subscriber.service";
import { NotificationSocketData } from "../types/notification-socket-data.type";

type NotificationSocket = Socket<
  Record<string, never>,
  Record<string, never>,
  Record<string, never>,
  NotificationSocketData
>;

@WebSocketGateway({ namespace: "/notifications" })
export class NotificationGateway
  implements
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit,
    OnModuleDestroy
{
  private readonly logger = new Logger(NotificationGateway.name);
  private removeRealtimeListener?: () => void;

  @WebSocketServer()
  private namespace!: Namespace;

  constructor(
    private readonly jwksService: JwksService,
    private readonly subscriber: NotificationRealtimeSubscriberService,
  ) {}

  // Đăng ký một listener duy nhất cho namespace; mọi domain notification đều đi qua cùng contract và cùng gateway.
  onModuleInit(): void {
    this.removeRealtimeListener = this.subscriber.onMessage((message) =>
      this.emitToAudiences(message),
    );
  }

  // Gỡ listener khi module dừng để hot reload không phát một event nhiều lần.
  onModuleDestroy(): void {
    this.removeRealtimeListener?.();
  }

  // Xác thực access token tại handshake, sau đó Gateway tự quyết định room từ profile đã được Auth Service resolve.
  async handleConnection(client: NotificationSocket): Promise<void> {
    try {
      const token = this.extractHandshakeToken(client);
      const payload = await this.jwksService.verifyToken(token);

      client.data = {
        userId: payload.sub,
        email: payload.email,
        roles: payload.roles,
        permissions: payload.permissions,
      };

      const rooms = new Set<string>([
        this.userRoom(payload.sub),
        "broadcast",
        ...payload.roles.map((role) => this.roleRoom(role)),
        ...payload.permissions.map((permission) =>
          this.permissionRoom(permission),
        ),
      ]);
      await client.join([...rooms]);

      this.logger.debug(
        `Notification socket connected for user ${payload.sub}`,
      );
    } catch (error) {
      this.logger.warn(
        `Rejected notification socket ${client.id}: ${String(error)}`,
      );
      client.disconnect(true);
    }
  }

  // Disconnect chỉ cần log ở mức debug; trạng thái đọc vẫn nằm trong MongoDB nên không có dữ liệu cần flush từ socket.
  handleDisconnect(client: NotificationSocket): void {
    if (client.data?.userId) {
      this.logger.debug(
        `Notification socket disconnected for user ${client.data.userId}`,
      );
    }
  }

  // Emit theo room union; Socket.IO tự loại trùng nếu một admin vừa khớp role vừa khớp permission của cùng notification.
  private emitToAudiences(message: NotificationRealtimeMessage): void {
    const rooms = message.audiences
      .map((audience) => this.resolveAudienceRoom(audience))
      .filter((room): room is string => Boolean(room));

    if (rooms.length === 0) {
      this.logger.warn(
        `Notification ${message.notification.id} has no routable audience`,
      );
      return;
    }

    this.namespace.to([...new Set(rooms)]).emit(message.name, message.notification);
  }

  // Chuyển audience backend thành tên room nội bộ; shop room đã được giữ sẵn cho lúc access profile có shop membership.
  private resolveAudienceRoom(audience: NotificationAudience): string | null {
    switch (audience.type) {
      case NotificationAudienceType.USER:
        return audience.value ? this.userRoom(audience.value) : null;
      case NotificationAudienceType.ROLE:
        return audience.value ? this.roleRoom(audience.value) : null;
      case NotificationAudienceType.PERMISSION:
        return audience.value
          ? this.permissionRoom(audience.value, audience.scope)
          : null;
      case NotificationAudienceType.SHOP:
        return audience.value ? `shop:${audience.value}` : null;
      case NotificationAudienceType.BROADCAST:
        return "broadcast";
      default:
        return null;
    }
  }

  // Access token chỉ được nhận từ handshake auth, không đưa lên query string để tránh lọt token vào access log hoặc browser history.
  private extractHandshakeToken(client: NotificationSocket): string {
    const token = client.handshake.auth?.token;
    if (typeof token !== "string" || token.length === 0) {
      throw new Error("Missing notification socket token");
    }
    return token;
  }

  // Các helper room giữ một quy ước duy nhất giữa join và emit, tránh lỗi typo khi hệ thống có thêm nhiều audience.
  private userRoom(userId: string): string {
    return `user:${userId}`;
  }

  private roleRoom(role: string): string {
    return `role:${role}`;
  }

  private permissionRoom(permission: string, scope?: string): string {
    return scope
      ? `permission:${permission}:scope:${scope}`
      : `permission:${permission}`;
  }
}
