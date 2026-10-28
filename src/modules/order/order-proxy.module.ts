// File này đăng ký các proxy route của Order Service, không chứa logic tạo đơn.

import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ProxyService } from '@/common/services/proxy.service';
import { OrderProxyController } from '@/modules/order/controllers/customer/order-proxy.controller';
import { SellerOrderProxyController } from '@/modules/order/controllers/seller/seller-order-proxy.controller';
import { Pay2sCallbackProxyController } from '@/modules/order/controllers/customer/pay2s-callback-proxy.controller';
import { Pay2sPayoutProxyController } from '@/modules/order/controllers/customer/pay2s-payout-proxy.controller';
import { SellerFinanceProxyController } from '@/modules/order/controllers/seller/seller-finance-proxy.controller';
import { AdminFinanceProxyController } from '@/modules/order/controllers/admin/admin-finance-proxy.controller';

// Module proxy độc lập giúp Gateway tổ chức theo từng domain nghiệp vụ.
@Module({
    imports: [HttpModule],
    controllers: [
        OrderProxyController,
        SellerOrderProxyController,
        Pay2sCallbackProxyController,
        Pay2sPayoutProxyController,
        SellerFinanceProxyController,
        AdminFinanceProxyController,
    ],
    providers: [ProxyService],
})
export class OrderProxyModule {}
