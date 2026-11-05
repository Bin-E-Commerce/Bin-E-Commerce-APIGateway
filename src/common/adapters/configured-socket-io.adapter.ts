import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';

export class ConfiguredSocketIoAdapter extends IoAdapter {
    constructor(
        app: INestApplicationContext,
        private readonly allowedOrigins: string[],
    ) {
        super(app);
    }

    // Áp dụng cùng allow-list CORS của HTTP cho Socket.IO để cấu hình local/production không bị lệch nhau.
    createIOServer(port: number, options?: ServerOptions): unknown {
        return super.createIOServer(port, {
            ...options,
            cors: {
                origin: this.allowedOrigins,
                credentials: true,
            },
            // Client mặc định bắt đầu bằng polling rồi nâng cấp lên WebSocket; giữ cả hai để proxy chặn WebSocket vẫn có fallback.
            transports: ['polling', 'websocket'],
        });
    }
}
