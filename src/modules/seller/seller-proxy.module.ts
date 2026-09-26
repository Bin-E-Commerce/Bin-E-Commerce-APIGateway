import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ProxyService } from '@/common/services/proxy.service';
import { SellerProxyController } from '@/modules/seller/seller-proxy.controller';

@Module({
    imports: [HttpModule],
    controllers: [SellerProxyController],
    providers: [ProxyService],
})
export class SellerProxyModule {}
