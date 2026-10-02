// Kiểm tra vòng đời SSE của proxy mà không mở HTTP server hay gọi microservice thật.
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { HttpService } from '@nestjs/axios';
import type { Request } from 'express';
import { Observable, of } from 'rxjs';
import { ProxyService } from '@/common/services/proxy.service';

describe('ProxyService.forwardStream', () => {
    // Tạo cặp request/response giả đủ hành vi để kiểm tra proxy chỉ hủy upstream khi browser rời đi.
    function createStreamFixture() {
        const upstream = new PassThrough();
        const mockHttpService = {
            request: jest
                .fn()
                .mockReturnValue(of({ status: 200, data: upstream })),
        };
        const target = new ProxyService(
            mockHttpService as unknown as HttpService,
        );
        const request = Object.assign(new EventEmitter(), {
            method: 'POST',
            body: { message: 'Câu hỏi' },
            headers: { 'x-request-id': 'request-1' },
            query: {},
            ip: '127.0.0.1',
            socket: { remoteAddress: '127.0.0.1' },
        });
        const response = Object.assign(new PassThrough(), {
            status: jest.fn().mockReturnThis(),
            setHeader: jest.fn(),
            flushHeaders: jest.fn(),
            json: jest.fn(),
        });

        return { target, upstream, request, response, mockHttpService };
    }

    // Request.close chỉ báo body đã được nhận; chỉ response.close mới có nghĩa browser đã ngắt SSE.
    it('should keep upstream alive after request completion and destroy it after client disconnect', async () => {
        // Arrange
        const { target, upstream, request, response } = createStreamFixture();

        // Act
        await target.forwardStream(
            'http://seller-service/seller/ai/copilot/chat/stream',
            request as unknown as Request,
            response as never,
        );
        request.emit('close');

        // Assert
        expect(upstream.destroyed).toBe(false);
        const responseClosed = new Promise<void>((resolve) =>
            response.once('close', resolve),
        );
        response.destroy();
        await responseClosed;
        expect(upstream.destroyed).toBe(true);
    });

    // Hủy request Axios ngay cả khi browser đóng trước khi Seller Service gửi SSE headers.
    it('should abort the pending upstream request when the client disconnects before headers', async () => {
        // Arrange
        let upstreamSignal: AbortSignal | undefined;
        const mockHttpService = {
            request: jest.fn((config: { signal?: AbortSignal }) => {
                upstreamSignal = config.signal;
                return new Observable<never>((subscriber) => {
                    config.signal?.addEventListener(
                        'abort',
                        () =>
                            subscriber.error(new Error('client disconnected')),
                        { once: true },
                    );
                });
            }),
        };
        const target = new ProxyService(
            mockHttpService as unknown as HttpService,
        );
        const request = Object.assign(new EventEmitter(), {
            method: 'POST',
            body: { message: 'Câu hỏi' },
            headers: { 'x-request-id': 'request-1' },
            query: {},
            ip: '127.0.0.1',
            socket: { remoteAddress: '127.0.0.1' },
        });
        const response = Object.assign(new PassThrough(), {
            status: jest.fn().mockReturnThis(),
            setHeader: jest.fn(),
            flushHeaders: jest.fn(),
            json: jest.fn(),
        });
        const pending = target.forwardStream(
            'http://seller-service/seller/ai/copilot/chat/stream',
            request as unknown as Request,
            response as never,
        );

        // Act
        const responseClosed = new Promise<void>((resolve) =>
            response.once('close', resolve),
        );
        response.destroy();
        await responseClosed;
        await pending;

        // Assert
        expect(upstreamSignal?.aborted).toBe(true);
        expect(response.writableEnded).toBe(false);
    });

    // Lỗi upstream sau khi headers đã flush phải phát event SSE error thay vì chỉ đóng stream yên lặng.
    it('should forward upstream stream failures as an SSE error event', async () => {
        // Arrange
        const { target, upstream, request, response } = createStreamFixture();
        let body = '';
        response.on('data', (chunk: Buffer) => {
            body += chunk.toString('utf8');
        });
        response.flushHeaders.mockImplementation(() => {
            Object.defineProperty(response, 'headersSent', {
                configurable: true,
                value: true,
            });
        });
        await target.forwardStream(
            'http://seller-service/seller/ai/copilot/chat/stream',
            request as unknown as Request,
            response as never,
        );
        const finished = new Promise<void>((resolve) =>
            response.once('finish', resolve),
        );

        // Act
        upstream.destroy(new Error('upstream disconnected'));
        await finished;

        // Assert
        expect(body).toContain('event: error');
        expect(body).toContain('COPILOT_UPSTREAM_STREAM_FAILED');
        expect(body).not.toContain('upstream disconnected');
    });
});
