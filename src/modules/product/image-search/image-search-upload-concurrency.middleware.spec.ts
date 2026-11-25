// Kiểm thử upload guard chạy trước parser để body bị từ chối không vào RAM process.
import { EventEmitter } from 'node:events';
import type { NextFunction, Request, Response } from 'express';
import {
    createImageSearchUploadConcurrencyMiddleware,
    isImageSearchUploadRequest,
} from '@/modules/product/image-search/image-search-upload-concurrency.middleware';

// Tạo request/response EventEmitter để mô phỏng vòng đời body và kết thúc HTTP response.
function createExchange(method: string, path: string) {
    const request = Object.assign(new EventEmitter(), { method, path });
    const response = Object.assign(new EventEmitter(), {
        status: jest.fn(),
        json: jest.fn(),
    });
    response.status.mockReturnValue(response);
    response.json.mockReturnValue(response);

    return {
        request: request as unknown as Request,
        response: response as unknown as Response,
        next: jest.fn() as unknown as NextFunction,
    };
}

describe('ImageSearchUploadConcurrencyMiddleware', () => {
    // Chỉ route POST upload và alias slash cuối được đọc body; subpath POST vẫn dừng ở 404 không buffer ảnh.
    it('matches only the image upload endpoint and its trailing-slash alias', () => {
        expect(
            isImageSearchUploadRequest(
                'POST',
                '/api/v1/products/image-searches',
            ),
        ).toBe(true);
        expect(
            isImageSearchUploadRequest(
                'POST',
                '/api/v1/products/image-searches/',
            ),
        ).toBe(true);
        expect(
            isImageSearchUploadRequest(
                'POST',
                '/api/v1/products/image-searches/extra',
            ),
        ).toBe(false);
        expect(
            isImageSearchUploadRequest(
                'GET',
                '/api/v1/products/image-searches',
            ),
        ).toBe(false);
    });

    // Chặn request thứ ba trước parser, rồi cho request mới đi tiếp khi response giải phóng slot.
    it('limits concurrent image uploads before parsing their bodies', () => {
        const middleware = createImageSearchUploadConcurrencyMiddleware();
        const first = createExchange('POST', '/api/v1/products/image-searches');
        const second = createExchange(
            'POST',
            '/api/v1/products/image-searches/',
        );
        const rejected = createExchange(
            'POST',
            '/api/v1/products/image-searches',
        );

        middleware(first.request, first.response, first.next);
        middleware(second.request, second.response, second.next);
        middleware(rejected.request, rejected.response, rejected.next);

        expect(first.next).toHaveBeenCalledTimes(1);
        expect(second.next).toHaveBeenCalledTimes(1);
        expect(rejected.next).not.toHaveBeenCalled();
        expect(rejected.response.status).toHaveBeenCalledWith(429);
        expect(rejected.response.json).toHaveBeenCalledWith({
            statusCode: 429,
            message: 'IMAGE_SEARCH_UPLOAD_CONCURRENCY_LIMIT',
        });

        first.response.emit('finish');
        const nextUpload = createExchange(
            'POST',
            '/api/v1/products/image-searches',
        );
        middleware(nextUpload.request, nextUpload.response, nextUpload.next);

        expect(nextUpload.next).toHaveBeenCalledTimes(1);
    });

    // Bỏ slot khi browser hủy upload và bỏ qua mọi route khác để không ảnh hưởng proxy còn lại.
    it('releases aborted uploads and ignores unrelated requests', () => {
        const middleware = createImageSearchUploadConcurrencyMiddleware();
        const unrelated = createExchange('POST', '/api/v1/products');
        const upload = createExchange(
            'POST',
            '/api/v1/products/image-searches',
        );
        const nextUpload = createExchange(
            'POST',
            '/api/v1/products/image-searches',
        );

        middleware(unrelated.request, unrelated.response, unrelated.next);
        middleware(upload.request, upload.response, upload.next);
        upload.request.emit('aborted');
        upload.response.emit('close');
        middleware(nextUpload.request, nextUpload.response, nextUpload.next);

        expect(unrelated.next).toHaveBeenCalledTimes(1);
        expect(upload.next).toHaveBeenCalledTimes(1);
        expect(nextUpload.next).toHaveBeenCalledTimes(1);
    });
});
