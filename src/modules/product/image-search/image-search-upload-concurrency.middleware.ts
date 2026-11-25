// Middleware giới hạn số upload ảnh đồng thời trước khi Express buffer request body.
import { HttpStatus } from '@nestjs/common';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

const MAX_CONCURRENT_IMAGE_SEARCH_UPLOADS = 2;
export const IMAGE_SEARCH_UPLOAD_PATH = '/api/v1/products/image-searches';

// Chỉ nhận route upload nguyên vẹn hoặc alias có một dấu slash cuối; subpath không được đọc raw body.
export function isImageSearchUploadRequest(
    method: string,
    path: string,
): boolean {
    return (
        method === 'POST' &&
        (path === IMAGE_SEARCH_UPLOAD_PATH ||
            path === `${IMAGE_SEARCH_UPLOAD_PATH}/`)
    );
}

// Tạo bộ đếm theo Gateway process để chặn upload vượt ngưỡng trước raw parser.
export function createImageSearchUploadConcurrencyMiddleware(): RequestHandler {
    let activeUploads = 0;

    return (request: Request, response: Response, next: NextFunction): void => {
        // Dùng cùng predicate với raw parser để slash cuối không mở đường né concurrency guard.
        if (!isImageSearchUploadRequest(request.method, request.path)) {
            next();
            return;
        }

        // Từ chối trước khi parser đọc body, giữ mức RAM tối đa gần 2 × body limit mỗi process.
        if (activeUploads >= MAX_CONCURRENT_IMAGE_SEARCH_UPLOADS) {
            response.status(HttpStatus.TOO_MANY_REQUESTS).json({
                statusCode: HttpStatus.TOO_MANY_REQUESTS,
                message: 'IMAGE_SEARCH_UPLOAD_CONCURRENCY_LIMIT',
            });
            return;
        }

        activeUploads += 1;
        let released = false;
        // Idempotent release xử lý cả response đóng bất thường và request bị client hủy.
        const release = (): void => {
            if (released) return;
            released = true;
            activeUploads = Math.max(0, activeUploads - 1);
        };

        response.once('finish', release);
        response.once('close', release);
        request.once('aborted', release);
        next();
    };
}
