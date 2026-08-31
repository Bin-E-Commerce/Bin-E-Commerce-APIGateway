// File này đăng ký proxy routes cho tracking, không chứa logic state machine hay provider.

import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ProxyService } from '../../common/services/proxy.service';
import { SellerShippingProxyController } from './seller-shipping-proxy.controller';
import { CustomerShippingProxyController } from './customer-shipping-proxy.controller';
import { ShippingLocationProxyController } from './shipping-location-proxy.controller';

// Tách shipment proxy khỏi order proxy để permission và upstream boundary dễ audit.
@Module({
  imports: [HttpModule],
  controllers: [SellerShippingProxyController, CustomerShippingProxyController, ShippingLocationProxyController],
  providers: [ProxyService],
})
export class ShippingProxyModule {}
