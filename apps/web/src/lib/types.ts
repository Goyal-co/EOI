/* eslint-disable @typescript-eslint/no-explicit-any */

export interface CustomerDashboard {
  hasEOI: boolean;
  eois?: Array<{
    eoiId: string | null;
    eoi?: { id?: string; status: string; referenceNumber?: string | null };
    project?: { id: string; name: string; location?: string };
    cpName?: string;
    customerName?: string;
    journeyStatus?: string;
  }>;
  activeEoiId?: string | null;
  eoi?: {
    id: string;
    status: string;
    journeyStatus?: string;
    referenceNumber?: string | null;
    confirmationNumber?: string;
    chequeUploaded?: boolean;
    adminRemarks?: string;
    rejectionReason?: string;
    submittedAt?: string;
    approvedAt?: string;
  };
  journeyStatus?: string;
  project?: {
    id: string;
    name: string;
    location: string;
    startingPrice: number;
    possessionDate?: string;
    bannerUrl?: string;
    amenities: string[];
    description?: string;
    faqs?: Array<{ question: string; answer: string }>;
    eoiStatus: string;
    assets?: Array<{ id: string; type: string; fileName: string; fileUrl: string }>;
  };
  cpName?: string;
  customerName?: string;
}

export interface AdminOverview {
  stats: Record<string, { value: number; growth: number }>;
  pendingApprovals: number;
  projectPerformance: Array<{
    id: string;
    name: string;
    location: string;
    eoiStatus: string;
    bannerUrl?: string;
    totalLeads: number;
    totalEois: number;
    totalClosures: number;
    conversionRate: number;
  }>;
  charts: {
    eoiTrend: Array<{ name: string; value: number }>;
    leadDistribution: Array<{ name: string; value: number }>;
    approvalRatio: Array<{ name: string; value: number }>;
  };
}

export interface Project {
  id: string;
  name: string;
  location: string;
  status: string;
  eoiStatus: string;
  eoiFormFiller?: "CUSTOMER" | "CP";
  startingPrice: number;
  possessionDate?: string;
  eoiCount?: number;
  activeCPs?: number;
  closures?: number;
  bannerUrl?: string;
  description?: string;
  amenities?: string[];
  createdAt?: string;
}

export interface ChannelPartner {
  id: string;
  name?: string;
  email?: string;
  companyName: string;
  reraNumber: string;
  mobile?: string;
  registeredLeads: number;
  submittedEOIs: number;
  approvedEOIs: number;
  closures: number;
  status: string;
  city?: string;
  createdAt?: string;
}

export interface Lead {
  id: string;
  customerName: string;
  mobile?: string;
  email?: string;
  customerEmail?: string;
  customerMobile?: string;
  project: string | { name: string };
  cpName?: string;
  siteVisitStatus?: string;
  leadStatus: string;
  journeyStatus?: string;
  intentType?: string;
  eoiStatus?: string;
  status?: string;
  dateAdded?: string;
  createdAt?: string;
  configuration?: string;
  budget?: string;
  notes?: string;
  eoi?: { status: string };
}

export interface PendingEOI {
  id: string;
  customerName: string;
  customerEmail: string;
  customerMobile: string;
  configuration?: string | null;
  fosName?: string | null;
  project: string;
  projectLocation: string;
  cpName: string;
  status: string;
  filledBy?: "CUSTOMER" | "CP";
  referenceNumber?: string;
  journeyStatus?: string;
  chequeNumber?: string;
  chequeUploaded?: boolean;
  formData?: Record<string, unknown>;
  piiMasked?: boolean;
  documents?: Array<{ id: string; type: string; fileName: string; fileUrl: string }>;
  submittedAt?: string;
  chequeDoc?: { id: string; fileUrl: string };
  eoiDocument?: { id: string; fileUrl: string; fileName?: string };
  adminRemarks?: string | null;
  rejectionReason?: string | null;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  entityType?: string;
  entityId?: string;
  createdAt: string;
}

export interface PartnerProject extends Project {
  assets?: Array<{ id: string; type: string; fileName: string; fileUrl: string }>;
  myLeads?: number;
  unitPreferences?: unknown;
  tags?: string[];
  locationImageUrl?: string;
  faqs?: Array<{ question: string; answer: string }>;
  eoiFormFiller?: "CUSTOMER" | "CP";
}

export interface PartnerEOI {
  id: string;
  status: string;
  filledBy?: "CUSTOMER" | "CP";
  confirmationNumber?: string;
  referenceNumber?: string;
  adminRemarks?: string;
  rejectionReason?: string;
  submittedAt?: string;
  lead: { customerName: string; customerEmail: string };
  project: { name: string };
  documents?: Array<{ id: string; type: string; fileName: string; fileUrl: string }>;
}

export interface Document {
  id: string;
  type: string;
  fileName: string;
  fileUrl: string;
  fileSize?: number;
  status: string;
  uploadedAt: string;
}
