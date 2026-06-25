export { sendEmail, shouldUseMockEmail, type EmailOptions, type EmailSendResult } from "./service";
export { sendEmailWithLog, processEmailRetryQueue, enqueueEmailRetry } from "./email-log";
export { NotificationService } from "./notifications";
export { isAdminNotificationEnabled, isTransactionalEmailType } from "./prefs";
export * from "./templates";
export * from "./email-layout";
export { getAppBaseUrl } from "./urls";
