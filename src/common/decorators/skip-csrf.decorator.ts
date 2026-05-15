import { SetMetadata } from "@nestjs/common";

export const SKIP_CSRF_KEY = "skipCsrf";
// Dùng để đánh dấu route không cần kiểm tra CSRF.
// Ví dụ: webhook từ bên ngoài, hoặc mobile app chưa hỗ trợ custom header.
export const SkipCsrf = () => SetMetadata(SKIP_CSRF_KEY, true);
