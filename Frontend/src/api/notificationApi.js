import { apiRequest } from "./authApi";

export const listNotifications = () => apiRequest("/notifications");
export const dismissNotification = (notificationId) => apiRequest(`/notifications/${encodeURIComponent(notificationId)}`, { method: "DELETE" });
