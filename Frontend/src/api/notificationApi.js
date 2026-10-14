import { apiRequest } from "./authApi";

export const listNotifications = () => apiRequest("/notifications");
