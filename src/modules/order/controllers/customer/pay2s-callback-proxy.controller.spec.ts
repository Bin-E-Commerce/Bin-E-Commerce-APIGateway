// Unit test callback boundary để bảo đảm Gateway không làm thay đổi dữ liệu đã được Pay2S ký.
import type { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import type { ProxyService } from '@/common/services/proxy.service';
import { Pay2sCallbackProxyController } from '@/modules/order/controllers/customer/pay2s-callback-proxy.controller';

describe('Pay2sCallbackProxyController', () => {
    function createResponse(): Response {
        return {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        } as unknown as Response;
    }

    function createTarget() {
        const proxyService = {
            forward: jest.fn().mockResolvedValue({
                data: { success: true },
                status: 200,
                headers: {},
            }),
        } as unknown as ProxyService;
        const config = {
            get: jest.fn().mockReturnValue('http://order-service:3004'),
        } as unknown as ConfigService;
        return {
            target: new Pay2sCallbackProxyController(config, proxyService),
            proxyService,
        };
    }

    // IPN phải dùng req.body nguyên bản; ProxyService tự forward body nên controller không serialize lại payload.
    it('forwards the Pay2S IPN without changing its JSON body', async () => {
        const { target, proxyService } = createTarget();
        const request = { method: 'POST', body: { amount: 100000 } } as Request;
        const response = createResponse();

        await target.processIpn(request, response);

        expect(proxyService.forward).toHaveBeenCalledWith(
            'http://order-service:3004/api/v1/payments/pay2s/ipn',
            request,
            {},
            { includeQueryParams: false },
        );
        expect(response.status).toHaveBeenCalledWith(200);
        expect(response.json).toHaveBeenCalledWith({ success: true });
    });

    // Redirect giữ nguyên chuỗi query gốc trong originalUrl để không làm sai canonical signature.
    it('forwards the Pay2S return query string verbatim', async () => {
        const { target, proxyService } = createTarget();
        const request = {
            method: 'GET',
            originalUrl:
                '/payments/pay2s/return?orderId=P2S-1&m2signature=abc%2Bdef',
        } as Request;
        const response = createResponse();

        await target.processReturn(request, response);

        expect(proxyService.forward).toHaveBeenCalledWith(
            'http://order-service:3004/api/v1/payments/pay2s/return?orderId=P2S-1&m2signature=abc%2Bdef',
            request,
            {},
            { includeQueryParams: false },
        );
    });
});
