import { INestApplicationContext } from "@nestjs/common";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { ServerOptions } from "socket.io";

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
      // Chỉ dùng WebSocket sau handshake để giảm request polling và tránh tạo thêm tải không cần thiết lên Gateway.
      transports: ["websocket"],
    });
  }
}
