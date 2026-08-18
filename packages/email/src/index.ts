export { sendEmail, shouldUseMockEmail, type EmailOptions, type EmailSendResult } from "./service";
export { sendEmailWithLog, processEmailRetryQueue, enqueueEmailRetry } from "./email-log";
export { NotificationService } from "./notifications";
export { isAdminNotificationEnabled, isTransactionalEmailType } from "./prefs";
export * from "./templates";
export * from "./email-layout";
export {
  resolveEmailTemplate,
  syncDefaultEmailTemplates,
  isMismatchedEmailTemplate,
} from "./template-loader";
export {
  getAppBaseUrl,
  getCustomerBaseUrl,
  getAdminBaseUrl,
  getPartnerBaseUrl,
  getCustomerPublicUrl,
  getPartnerPublicUrl,
  getAdminPublicUrl,
  getCustomerLoginUrl,
  getCustomerPortalUrl,
  getCustomerEoiUrl,
  getCustomerResetPasswordUrl,
  getCustomerConfirmUrl,
  getPartnerLoginUrl,
  getPartnerDashboardUrl,
  getPartnerLeadsUrl,
  getPartnerResetPasswordUrl,
  getAdminLoginUrl,
  getAdminLeadsUrl,
  canonicalizeEmailUrl,
  rewriteEmailHtmlUrls,
} from "./urls";
