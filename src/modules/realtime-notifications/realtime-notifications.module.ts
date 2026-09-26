import { Module } from '@nestjs/common';
import { NotificationGateway } from '@/modules/realtime-notifications/gateways/notification.gateway';
import { NotificationRealtimeSubscriberService } from '@/modules/realtime-notifications/services/notification-realtime-subscriber.service';

@Module({
    providers: [NotificationRealtimeSubscriberService, NotificationGateway],
})
export class RealtimeNotificationsModule {}
