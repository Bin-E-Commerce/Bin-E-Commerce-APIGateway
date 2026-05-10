import { NestFactory } from "@nestjs/core";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"],
  });

  // Để ThrottlerModule trong NestJS hoạt động đúng,
  // bạn PHẢI cấu hình NestJS tin tưởng Proxy.
  // Nếu không, NestJS sẽ thấy mọi request đều đến từ IP của... Nginx (thường là 127.0.0.1 hoặc IP nội bộ Docker).
  // Khi đó, NestJS sẽ hiểu nhầm tất cả người dùng trên thế giới là 1 người
  // và khóa toàn bộ hệ thống sau 100 request đầu tiên.
  // Cấu hình này cho phép NestJS lấy đúng IP thật của client qua header X-Forwarded-For mà Nginx đã thêm vào,
  // giúp ThrottlerModule hoạt động chính xác và chỉ khóa những IP thực sự gửi quá nhiều request.
  app.getHttpAdapter().getInstance().set("trust proxy", 1);

  const config = app.get(ConfigService);
  const port = config.get<number>("PORT", 3000);

  app.setGlobalPrefix("api");
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });

  // Dùng để tự động validate các DTO dựa trên class-validator decorators
  // Đồng thời loại bỏ các trường không có trong DTO (whitelist)
  // Từ chối các request có trường không hợp lệ (forbidNonWhitelisted)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const allowedOrigins = config
    .get<string>("ALLOWED_ORIGINS", "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  // Chỉ bật Swagger trong môi trường phát triển để tránh lộ thông tin API trong production
  if (config.get<string>("NODE_ENV") !== "production") {
    const doc = new DocumentBuilder()
      .setTitle("Bin E-Commerce — API Gateway")
      .setDescription("Aggregated API documentation for all microservices")
      .setVersion("1.0")
      .addBearerAuth()
      .build();
    SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, doc));
  }

  // Kích hoạt graceful shutdown để đảm bảo rằng API Gateway có thể tắt một cách an toàn khi nhận được tín hiệu dừng (ví dụ: SIGINT, SIGTERM)
  app.enableShutdownHooks();

  await app.listen(port);
  console.log(`[api-gateway] Running on port ${port}`);
}

bootstrap();
