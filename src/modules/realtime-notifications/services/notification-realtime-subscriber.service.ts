import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import Redis from "ioredis";
import {
  NOTIFICATION_REALTIME_CHANNEL,
  NotificationRealtimeEvents,
  NotificationRealtimeMessage,
} from "@common/notifications";
import { REDIS_CLIENT } from "../../../database/redis/redis.module";

type NotificationMessageListener = (
  message: NotificationRealtimeMessage,
) => void | Promise<void>;

@Injectable()
export class NotificationRealtimeSubscriberService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(
    NotificationRealtimeSubscriberService.name,
  );
  private readonly listeners = new Set<NotificationMessageListener>();
  private subscriber?: Redis;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  // Dùng duplicate connection vì Redis subscriber sau SUBSCRIBE không được dùng cho lệnh thông thường hoặc rate limit.
  async onModuleInit(): Promise<void> {
    this.subscriber = this.redis.duplicate();
    this.subscriber.on("message", (channel, rawMessage) => {
      if (channel !== NOTIFICATION_REALTIME_CHANNEL) return;

      const message = this.parseMessage(rawMessage);
      if (!message) return;

      // Một listener lỗi không được chặn các listener khác; mỗi lỗi được log để vẫn quan sát được pipeline realtime.
      for (const listener of this.listeners) {
        Promise.resolve(listener(message)).catch((error: unknown) => {
          this.logger.error(
            `Notification realtime listener failed: ${String(error)}`,
          );
        });
      }
    });

    try {
      if (this.subscriber.status === "wait") {
        await this.subscriber.connect();
      }
      await this.subscriber.subscribe(NOTIFICATION_REALTIME_CHANNEL);
      this.logger.log(
        `Subscribed to Redis channel ${NOTIFICATION_REALTIME_CHANNEL}`,
      );
    } catch (error) {
      // REST notification feed vẫn hoạt động khi Redis tạm lỗi; realtime sẽ phục hồi sau khi process được restart/reconnect.
      this.logger.error(
        `Could not subscribe to notification realtime channel: ${String(error)}`,
      );
    }
  }

  // Cho gateway đăng ký listener mà không phụ thuộc trực tiếp vào API của ioredis.
  onMessage(listener: NotificationMessageListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Hủy subscription và connection riêng để dev watch/rolling deployment không giữ socket Redis bị treo.
  async onModuleDestroy(): Promise<void> {
    this.listeners.clear();
    if (!this.subscriber) return;

    await this.subscriber
      .unsubscribe(NOTIFICATION_REALTIME_CHANNEL)
      .catch(() => void 0);
    await this.subscriber.quit().catch(() => void 0);
  }

  // Chỉ chấp nhận event name và các field nền tảng bắt buộc; payload hỏng bị bỏ qua thay vì làm sập Gateway.
  private parseMessage(rawMessage: string): NotificationRealtimeMessage | null {
    try {
      const message = JSON.parse(rawMessage) as NotificationRealtimeMessage;
      if (
        message.name !== NotificationRealtimeEvents.CREATED ||
        !Array.isArray(message.audiences) ||
        !message.notification?.id
      ) {
        throw new Error("Invalid notification realtime contract");
      }
      return message;
    } catch (error) {
      this.logger.warn(
        `Ignored malformed notification realtime message: ${String(error)}`,
      );
      return null;
    }
  }
}
