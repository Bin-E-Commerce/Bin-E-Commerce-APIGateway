import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ProxyService } from '@/common/services/proxy.service';
import { CatalogProxyController } from '@/modules/catalog/catalog-proxy.controller';

@Module({
    imports: [HttpModule],
    controllers: [CatalogProxyController],
    providers: [ProxyService],
})
export class CatalogProxyModule {}
