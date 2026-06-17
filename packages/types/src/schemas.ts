import { z } from "zod";
import { normalizeEmail } from "./email";

export const loginSchema = z.object({
  email: z.preprocess(
    (val) => (typeof val === "string" ? normalizeEmail(val) : val),
    z.string().email("Invalid email address"),
  ),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const cpRegisterStep1Schema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  mobile: z.string().regex(/^[6-9]\d{9}$/, "Invalid Indian mobile number"),
  email: z.preprocess(
    (val) => (typeof val === "string" ? normalizeEmail(val) : val),
    z.string().email("Invalid email address"),
  ),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const cpRegisterStep2Schema = z.object({
  companyName: z.string().optional(),
  reraNumber: z.string().min(5, "RERA number is required"),
  panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN format"),
  gstNumber: z.string().optional(),
});

export const projectFaqSchema = z.object({
  question: z.string().min(1, "Question is required"),
  answer: z.string().min(1, "Answer is required"),
});

export const projectSchema = z.object({
  name: z.string().min(2, "Project name is required"),
  location: z.string().min(2, "Location is required"),
  locationLink: z
    .string()
    .url("Location link must be a valid URL")
    .optional()
    .or(z.literal("")),
  startingPrice: z.number().positive("Price per sqft must be positive"),
  possessionDate: z.string().optional(),
  description: z.string().optional(),
  amenities: z.array(z.string()).optional(),
  faqs: z.array(projectFaqSchema).optional(),
  eoiStatus: z.enum(["OPEN", "CLOSED"]).default("OPEN"),
  status: z.enum(["ACTIVE", "INACTIVE", "UPCOMING"]).default("ACTIVE"),
});

export const leadCreateSchema = z.object({
  customerName: z.string().min(2, "Customer name is required"),
  mobile: z.string().regex(/^[6-9]\d{9}$/, "Invalid mobile number"),
  email: z.preprocess(
    (val) => (typeof val === "string" ? normalizeEmail(val) : val),
    z.string().email("Invalid email"),
  ),
  projectId: z.string().min(1, "Project is required"),
  configuration: z.string().min(1, "Unit preference is required"),
  fosName: z.string().min(1, "FOS name is required"),
  budget: z.string().optional(),
  city: z.string().optional(),
  notes: z.string().optional(),
  sendConfirmation: z.boolean().optional(),
  intentType: z.enum(["EOI", "LEAD_ONLY"]).optional(),
});

export const eoiPersonalDetailsSchema = z.object({
  fullName: z.string().min(2),
  dob: z.string().min(1),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  mobile: z.string().regex(/^[6-9]\d{9}$/),
  email: z.string().email(),
  panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/),
  aadhaarNumber: z.string().regex(/^\d{12}$/),
});

export const eoiAddressSchema = z.object({
  currentAddress: z.string().min(5),
  city: z.string().min(2),
  state: z.string().min(2),
  pincode: z.string().regex(/^\d{6}$/),
  occupation: z.string().min(2),
  companyName: z.string().optional(),
  annualIncome: z.string().min(1),
});

export const eoiUnitPreferenceSchema = z.object({
  preferredConfiguration: z.string().min(1),
  preferredTower: z.string().optional(),
  budgetRange: z.string().min(1),
  additionalNotes: z.string().optional(),
});

export const eoiBankDetailsSchema = z.object({
  bankName: z.string().min(2),
  accountHolderName: z.string().min(2),
  chequeNumber: z.string().min(1),
});

export const approvalActionSchema = z.object({
  action: z.enum(["APPROVE", "REJECT", "REQUEST_CORRECTION"]),
  reason: z.string().optional(),
  remarks: z.string().optional(),
});

export const customerProfileSchema = z.object({
  fullName: z.string().min(2),
  mobile: z.string().regex(/^[6-9]\d{9}$/),
  email: z.string().email(),
});

export const confirmActionSchema = z.object({
  action: z.enum(["accept", "reject"]),
});

export const cpStatusUpdateSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "BLOCKED"]).optional(),
  projectIds: z.array(z.string()).optional(),
  blockReason: z.string().min(3).optional(),
}).refine(
  (data) => data.status || (data.projectIds && data.projectIds.length > 0),
  { message: "Either status or projectIds must be provided" }
);

export const adminSettingsSchema = z.object({
  profile: z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    supportEmail: z.string().email().optional(),
  }).optional(),
  notifications: z.object({
    newEoi: z.boolean().optional(),
    cpRegistration: z.boolean().optional(),
    approvalReminders: z.boolean().optional(),
    projectUpdates: z.boolean().optional(),
    emailDigest: z.string().optional(),
  }).optional(),
  eoiRules: z.object({
    autoReview: z.boolean().optional(),
    requireCheque: z.boolean().optional(),
    minDeposit: z.string().optional(),
    maxPendingDays: z.string().optional(),
    allowCorrections: z.boolean().optional(),
  }).optional(),
  permissions: z.object({
    cpCanViewAnalytics: z.boolean().optional(),
    cpCanExportLeads: z.boolean().optional(),
    customerCanEditEOI: z.boolean().optional(),
    requireAdminApproval: z.boolean().optional(),
  }).optional(),
});

export const partnerSettingsSchema = z.object({
  emailNotifications: z.boolean().optional(),
  inAppNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  eoiUpdates: z.boolean().optional(),
  leadAlerts: z.boolean().optional(),
  profileVisible: z.boolean().optional(),
  shareAnalytics: z.boolean().optional(),
});

export const partnerProfileSchema = z.object({
  name: z.string().min(2).optional(),
  mobile: z.string().regex(/^[6-9]\d{9}$/).optional(),
  companyName: z.string().optional(),
  reraNumber: z.string().min(5).optional(),
  panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).optional(),
  gstNumber: z.string().optional(),
  officeAddress: z.string().optional(),
  city: z.string().optional(),
});

export const projectAssetSchema = z.object({
  type: z.enum(["BROCHURE", "COST_SHEET", "FLOOR_PLAN", "GALLERY", "BANNER"]),
  fileName: z.string().min(1),
  fileUrl: z.string().url(),
  fileSize: z.number().optional(),
});

export const leadPatchSchema = z.object({
  siteVisitStatus: z.enum(["NOT_SCHEDULED", "SCHEDULED", "COMPLETED", "CANCELLED"]).optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
  confirmPassword: z.string().min(8),
}).refine((d) => d.password === d.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });

export const adminUserCreateSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

export const emailTemplatePatchSchema = z.object({
  type: z.string().min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
});

export const projectEoiRuleSchema = z.object({
  minBudget: z.number().positive().optional(),
  requiredDocuments: z.array(z.string()).optional(),
});

export const adminProjectPatchSchema = projectSchema.partial();

export const customerEoiStepSchema = z.object({
  step: z.enum(["personal", "address", "unitPreference", "bankDetails", "review"]),
  data: z.record(z.unknown()),
  submit: z.boolean().optional(),
});

export const notificationMarkReadSchema = z.object({
  ids: z.array(z.string()).optional(),
  markAll: z.boolean().optional(),
});

export const documentUploadSchema = z.object({
  type: z.enum(["CHEQUE", "PAN", "AADHAAR", "RERA_CERT", "VISITING_CARD", "BROCHURE", "COST_SHEET", "FLOOR_PLAN", "BANNER"]),
  fileName: z.string().min(1),
  fileUrl: z.string().min(1),
  fileSize: z.number().optional(),
  mimeType: z.string().optional(),
  eoiId: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CPRegisterStep1 = z.infer<typeof cpRegisterStep1Schema>;
export type CPRegisterStep2 = z.infer<typeof cpRegisterStep2Schema>;
export type ProjectInput = z.infer<typeof projectSchema>;
export type LeadCreateInput = z.infer<typeof leadCreateSchema>;
export type EOIPersonalDetails = z.infer<typeof eoiPersonalDetailsSchema>;
export type EOIAddress = z.infer<typeof eoiAddressSchema>;
export type EOIUnitPreference = z.infer<typeof eoiUnitPreferenceSchema>;
export type EOIBankDetails = z.infer<typeof eoiBankDetailsSchema>;
export type ApprovalActionInput = z.infer<typeof approvalActionSchema>;
