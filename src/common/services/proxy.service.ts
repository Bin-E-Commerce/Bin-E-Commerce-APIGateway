// Module này cung cấp dịch vụ proxy để chuyển tiếp các request từ API Gateway đến các microservices khác trong hệ thống
// Nó sử dụng HttpService của NestJS để thực hiện các request HTTP và xử lý lỗi một cách hiệu quả, đảm bảo rằng các lỗi từ upstream service được trả về đúng cách cho client
// Dịch vụ này cũng đảm bảo rằng các header cần thiết như thông tin người dùng được inject từ JWT guard sẽ được forward đến các service downstream
// Lý do đặt tên là ProxyService vì nó đóng vai trò như một proxy để chuyển tiếp các request, giúp tách biệt logic của API Gateway với các microservices khác
// và đảm bảo rằng các lỗi được xử lý một cách nhất quán

import {
    Injectable,
    Logger,
    HttpException,
    ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosError, AxiosRequestConfig } from 'axios';
import { Readable } from 'node:stream';
import type { Request } from 'express';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ProxyService {
    private readonly logger = new Logger(ProxyService.name);

    // Khởi tạo ProxyService với HttpService để thực hiện các request HTTP đến các microservices khác
    constructor(private readonly httpService: HttpService) {}

    // Phương thức chính để forward request đến targetUrl
    // Xây dựng cấu hình request dựa trên request gốc
    // Và xử lý response cũng như lỗi một cách hiệu quả
    // Mục đích hàm này là để chuyển tiếp request từ API Gateway đến các microservices khác
    // Đồng thời đảm bảo rằng các lỗi từ upstream service được trả về đúng cách cho client
    async forward(
        targetUrl: string,
        req: Request,
        additionalHeaders: Record<string, string> = {},
    ): Promise<{
        data: unknown;
        status: number;
        headers: Record<string, string | string[]>;
    }> {
        const config: AxiosRequestConfig = {
            method: req.method as AxiosRequestConfig['method'],
            url: targetUrl,
            data: req.body,
            headers: this.buildForwardHeaders(req), // Xây dựng header để forward, bao gồm cả thông tin người dùng được inject từ JWT guard
            params: req.query, // Forward query parameters, ví dụ như ?page=1&limit=10
            validateStatus: () => true, // Cho phép xử lý tất cả các status code trong response, không tự động throw lỗi cho status >= 400 để chúng ta có thể trả về đúng lỗi từ upstream service cho client
        };
        // Header nội bộ được thêm sau context client để browser không thể ghi đè service identity.
        Object.assign(
            config.headers as Record<string, string>,
            additionalHeaders,
        );

        try {
            // Thực hiện request đến targetUrl bằng HttpService và chờ response
            const response = await firstValueFrom(
                this.httpService.request(config),
            );
            return {
                data: response.data as unknown,
                status: response.status,
                headers: response.headers as Record<string, string | string[]>,
            };
        } catch (err) {
            // Xử lý lỗi từ request đến targetUrl, log lỗi và trả về lỗi phù hợp cho client
            const axiosErr = err as AxiosError;
            this.logger.error(
                `Proxy error to ${targetUrl}: ${axiosErr.message}`,
            );

            if (axiosErr.response) {
                throw new HttpException(
                    axiosErr.response.data as object,
                    axiosErr.response.status,
                );
            }

            // Nếu không có response từ upstream (ví dụ: network error), trả về lỗi 503 Service Unavailable
            throw new ServiceUnavailableException(
                'Upstream service unavailable',
            );
        }
    }

    // Forward binary response như nhãn PDF mà không ép dữ liệu thành JSON.
    // Dùng cho các endpoint trả về file hoặc dữ liệu nhị phân, ví dụ như PDF, hình ảnh, video.
    async forwardBinary(
        targetUrl: string,
        req: Request,
    ): Promise<{
        data: Buffer;
        status: number;
        headers: Record<string, string | string[]>;
    }> {
        try {
            const response = await firstValueFrom(
                this.httpService.request<Buffer>({
                    method: req.method as AxiosRequestConfig['method'],
                    url: targetUrl,
                    data: req.body,
                    headers: this.buildForwardHeaders(req),
                    params: req.query,
                    responseType: 'arraybuffer',
                    validateStatus: () => true,
                }),
            );
            return {
                data: Buffer.from(response.data),
                status: response.status,
                headers: response.headers as Record<string, string | string[]>,
            };
        } catch (err) {
            const axiosErr = err as AxiosError;
            this.logger.error(
                `Proxy binary error to ${targetUrl}: ${axiosErr.message}`,
            );
            if (axiosErr.response)
                throw new HttpException(
                    axiosErr.response.data as object,
                    axiosErr.response.status,
                );
            throw new ServiceUnavailableException(
                'Upstream service unavailable',
            );
        }
    }

    // Forward SSE bằng stream để Gateway không buffer toàn bộ câu trả lời AI trước khi trả về browser.
    // Theo dõi response của browser (không phải request body) để chỉ hủy upstream khi client thật sự rời đi.
    // Nếu upstream lỗi sau khi headers đã gửi, phát SSE error để frontend không hiểu EOF là hoàn tất thành công.
    async forwardStream(
        targetUrl: string,
        req: Request,
        res: import('express').Response,
    ): Promise<void> {
        const abortController = new AbortController();
        const handleClientClose = () => abortController.abort();
        // Client có thể dừng khi Gateway còn chờ Seller Service trả headers; hủy cả request upstream đang chờ.
        res.once('close', handleClientClose);

        try {
            // Thực hiện request đến targetUrl bằng HttpService và chờ response dạng stream
            const upstream = await firstValueFrom(
                this.httpService.request({
                    method: req.method as AxiosRequestConfig['method'],
                    url: targetUrl,
                    data: req.body,
                    headers: this.buildForwardHeaders(req),
                    params: req.query,
                    responseType: 'stream',
                    timeout: 0,
                    validateStatus: () => true,
                    signal: abortController.signal,
                }),
            );

            // Nếu client đã hủy request trong lúc chờ upstream, không log như lỗi dịch vụ và không ghi vào socket đóng.
            res.off('close', handleClientClose);
            if (abortController.signal.aborted || res.destroyed) {
                const abandonedStream = upstream.data as Readable;
                abandonedStream.destroy();
                return;
            }

            res.status(upstream.status);
            res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache, no-transform');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no');
            res.flushHeaders();

            // Forward tất cả các header từ upstream, ngoại trừ những header có thể gây lỗi khi gửi đến client (ví dụ: transfer-encoding, content-length)
            const stream = upstream.data as Readable;
            const cleanup = () => {
                res.off('close', cleanup);
                if (!stream.destroyed) stream.destroy();
            };
            const removeCloseListener = () => res.off('close', cleanup);
            res.once('close', cleanup);
            stream.once('end', removeCloseListener);
            stream.once('error', (error: Error) => {
                removeCloseListener();
                if (res.destroyed || res.writableEnded) return;

                const requestId = String(
                    req.headers['x-request-id'] ?? 'unknown',
                );
                this.logger.error(
                    JSON.stringify({
                        event: 'seller_copilot_upstream_stream_failed',
                        requestId,
                        errorType: error.name,
                    }),
                );

                // Headers đã gửi nên không đổi status; chuẩn hóa lỗi thành event mà client biết cách hiển thị.
                res.write(
                    `event: error\ndata: ${JSON.stringify({
                        type: 'error',
                        code: 'COPILOT_UPSTREAM_STREAM_FAILED',
                        retryable: true,
                        message:
                            'Kết nối tới trợ lý bị gián đoạn. Bạn thử lại giúp mình nhé.',
                    })}\n\n`,
                );
                res.end();
            });
            stream.pipe(res);
        } catch (err) {
            res.off('close', handleClientClose);
            // Browser đã hủy request trong lúc chờ upstream; không log như lỗi dịch vụ và không ghi vào socket đóng.
            if (abortController.signal.aborted || res.destroyed) return;

            const axiosErr = err as AxiosError;
            this.logger.error(
                `Proxy stream error to ${targetUrl}: ${axiosErr.message}`,
            );
            if (!res.headersSent) {
                res.status(503).json({
                    message: 'Upstream service unavailable',
                });
            } else {
                res.end();
            }
        }
    }

    // Xây dựng header để forward, bao gồm cả thông tin người dùng được inject từ JWT guard
    // Dùng để đảm bảo rằng các service downstream có thể nhận được thông tin người dùng (user context) để thực hiện authorization hoặc logging nếu cần thiết
    private buildForwardHeaders(req: Request): Record<string, string> {
        const forward: Record<string, string> = {};

        // Forward injected user context headers from JWT guard,
        // and x-session-id which is sent by the client to identify the current session (used for isCurrent flag in session list)
        const ctxHeaders = [
            'x-user-id',
            'x-user-email',
            'x-user-name',
            'x-user-avatar-url',
            'x-user-roles',
            'x-user-permissions',
            'x-session-id',
            'idempotency-key',
            'x-request-id',
            'user-agent',
        ];
        for (const h of ctxHeaders) {
            const val = req.headers[h];
            if (val) forward[h] = String(val);
        }

        // Forward content-type nếu có, để đảm bảo downstream service có thể parse body đúng cách
        // content-type thường là application/json cho các request API, nhưng cũng có thể là multipart/form-data hoặc các loại khác tùy vào endpoint
        if (req.headers['content-type']) {
            forward['content-type'] = req.headers['content-type'];
        }

        // Forward cookie nếu có, để đảm bảo downstream service có thể nhận được session hoặc thông tin xác thực nếu cần thiết
        // Dùng cho các trường hợp auth-service sử dụng httpOnly cookies để quản lý session
        // Khi đó chúng ta cần forward cookie từ client đến auth-service để auth-service có thể xác thực người dùng
        if (req.headers['cookie']) {
            forward['cookie'] = req.headers['cookie'];
        }

        // Chỉ lấy IP đã được Express chuẩn hóa từ proxy tin cậy. Không dùng trực tiếp
        // x-forwarded-for do client tự gửi, vì header đó có thể bị giả mạo và làm sai audit.
        const ip = req.ip ?? req.socket.remoteAddress;
        if (ip) forward['x-forwarded-for'] = String(ip);

        return forward;
    }
}
