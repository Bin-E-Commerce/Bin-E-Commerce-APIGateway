import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ProxyService } from '@/common/services/proxy.service';
import { AdminSellerKnowledgeProxyController } from '@/modules/seller-knowledge/admin-seller-knowledge-proxy.controller';

// Gateway feature tách quyền tài liệu AI khỏi seller proxy thông thường để mỗi hành động có permission riêng.
@Module({
    imports: [HttpModule],
    controllers: [AdminSellerKnowledgeProxyController],
    providers: [ProxyService],
})
export class SellerKnowledgeProxyModule {}
