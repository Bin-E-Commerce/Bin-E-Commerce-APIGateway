import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

// Dùng để đánh dấu các route hoặc controller không yêu cầu xác thực JWT
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);

// Tạo ra một decorator @Public() có thể áp dụng cho cả phương thức
// và lớp để chỉ định rằng chúng không yêu cầu xác thực JWT.
// Decorator này sử dụng SetMetadata để gắn metadata "isPublic" với giá trị true,
// cho phép JwtAuthGuard bỏ qua kiểm tra JWT cho các route hoặc controller được đánh dấu là public.
