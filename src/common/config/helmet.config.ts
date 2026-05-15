import type { HelmetOptions } from "helmet";

// Mục đích của hàm này là để tạo ra một đối tượng cấu hình cho middleware Helmet, tùy theo môi trường (development hay production).
// Trong môi trường development, chúng ta có thể tắt một số tính năng bảo mật để tiện cho việc phát triển và debug (ví dụ: tắt CSP để Swagger UI hoạt động).
// Trong môi trường production, chúng ta bật tất cả các tính năng bảo mật để bảo vệ ứng dụng khỏi các loại tấn công phổ biến như XSS, Clickjacking, MIME sniffing, v.v.
export function buildHelmetOptions(isDev: boolean): HelmetOptions {
  return {
    // Ẩn header "X-Powered-By: Express" tránh lộ tech stack
    hidePoweredBy: true,

    // Ngăn browser đoán MIME type (tấn công MIME sniffing)
    noSniff: true,

    // Chặn iframe nhúng trang — chống Clickjacking
    frameguard: { action: "deny" },

    // Bật XSS filter của browser cũ (IE/Chrome cũ)
    xssFilter: true,

    // HTTP Strict-Transport-Security: bắt buộc HTTPS trong 1 năm
    // Chỉ bật trong production vì dev chạy HTTP
    hsts: isDev
      ? false
      : {
          maxAge: 31_536_000, // 1 năm (giây)
          includeSubDomains: true,
          preload: true,
        },

    // Content-Security-Policy
    // Dev: tắt để Swagger UI (inline script/style) không bị chặn
    // Production: strict, chỉ cho phép same-origin
    contentSecurityPolicy: isDev
      ? false
      : {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
            upgradeInsecureRequests: [],
          },
        },

    // Kiểm soát thông tin Referer gửi ra ngoài
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },

    // Chặn DNS prefetch — giảm leak thông tin nội bộ
    dnsPrefetchControl: { allow: false },
  };
}
