import { Module } from "@nestjs/common";
import { NotificationGateway } from "./gateways/notification.gateway";
import { NotificationRealtimeSubscriberService } from "./services/notification-realtime-subscriber.service";

@Module({
  providers: [NotificationRealtimeSubscriberService, NotificationGateway],
})
export class RealtimeNotificationsModule {}
