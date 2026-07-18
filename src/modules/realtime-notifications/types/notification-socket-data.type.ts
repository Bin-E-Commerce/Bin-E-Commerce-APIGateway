import { Permission } from "@common/auth";

// Context này do Gateway tạo sau khi xác thực JWT; client không thể tự gán role hoặc permission vào socket.data.
export interface NotificationSocketData {
  userId: string;
  email: string;
  roles: string[];
  permissions: Permission[];
}
