// Kiểm thử RED metrics dùng chung: route lạ phải bounded và response bị hủy phải nhả gauge.
import { EventEmitter } from 'node:events';
import type { Request, RequestHandler, Response } from 'express';
import { setupHttpObservability } from '@common/observability/http-observability';

// Tạo adapter Express tối thiểu để test middleware mà không khởi động Gateway hoặc service ngoài.
function createObservabilityHarness() {
    let registeredMiddleware: RequestHandler | undefined;
    const httpAdapter = {
        get: jest.fn(),
        use: (handler: RequestHandler) => {
            registeredMiddleware = handler;
        },
    };
    const application = {
        getHttpAdapter: () => ({ getInstance: () => httpAdapter }),
        useLogger: jest.fn(),
    } as unknown as Parameters<typeof setupHttpObservability>[0];
    const metrics = setupHttpObservability(application, 'test-service');

    if (!registeredMiddleware) {
        throw new Error('OBSERVABILITY_MIDDLEWARE_NOT_REGISTERED');
    }

    return { middleware: registeredMiddleware, metrics };
}

// Tạo response EventEmitter để kiểm soát riêng finish và close như Express runtime.
function createResponse(): Response {
    return Object.assign(new EventEmitter(), {
        statusCode: 200,
        setHeader: jest.fn(),
        end: jest.fn(),
    }) as unknown as Response;
}

describe('shared HTTP observability', () => {
    // Path không match không được tạo series theo URL; close chưa finish phải nhả đúng một slot in-flight.
    it('bounds unmatched labels and releases the gauge for aborted responses', () => {
        const { middleware, metrics } = createObservabilityHarness();
        const request = {
            method: 'CUSTOM-VERB-123',
            path: '/arbitrary/client/path',
            originalUrl: '/arbitrary/client/path?secret=value',
            headers: {},
        } as unknown as Request;
        const response = createResponse();

        middleware(request, response, jest.fn());
        response.emit('close');
        response.emit('close');

        const rendered = metrics.render();

        expect(rendered).toContain(
            'http_requests_aborted_total{method="OTHER",route="unmatched",service="test-service"} 1',
        );
        expect(rendered).toContain(
            'http_requests_in_flight{service="test-service"} 0',
        );
        expect(rendered).not.toContain('/arbitrary/client/path');
        expect(rendered).not.toContain('secret=value');
    });

    // Response thành công chỉ phát một outcome và close tiếp theo không được tính nhầm là abort.
    it('records the matched route template and ignores close after finish', () => {
        const { middleware, metrics } = createObservabilityHarness();
        const request = {
            method: 'get',
            path: '/api/v1/products/123',
            route: { path: '/api/v1/products/:productId' },
            headers: {},
        } as unknown as Request;
        const response = createResponse();

        middleware(request, response, jest.fn());
        response.emit('finish');
        response.emit('close');

        const rendered = metrics.render();

        expect(rendered).toContain(
            'http_requests_total{method="GET",route="/api/v1/products/:productId",service="test-service"} 1',
        );
        expect(rendered).not.toContain('http_requests_aborted_total');
        expect(rendered).toContain(
            'http_requests_in_flight{service="test-service"} 0',
        );
    });
});
