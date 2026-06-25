"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  CustomerDashboard, AdminOverview, Project, ChannelPartner,
  Lead, PendingEOI, Notification, PartnerProject, PartnerEOI, Document,
} from "./types";

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.json()).error || "Request failed");
  return res.json();
}

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetcher<{ notifications: Notification[]; unreadCount: number }>("/api/notifications"),
    refetchInterval: 30_000,
  });
}

export function useAdminOverview() {
  return useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => fetcher<AdminOverview>("/api/admin/analytics/overview"),
  });
}

export function useAdminProjects() {
  return useQuery({
    queryKey: ["admin", "projects"],
    queryFn: () => fetcher<Project[]>("/api/admin/projects"),
  });
}

export function useAdminCPs() {
  return useQuery({
    queryKey: ["admin", "cps"],
    queryFn: () => fetcher<ChannelPartner[]>("/api/admin/channel-partners"),
  });
}

export function useAdminLeads(filters?: Record<string, string>) {
  const params = new URLSearchParams(filters);
  return useQuery({
    queryKey: ["admin", "leads", filters],
    queryFn: () => fetcher<Lead[]>(`/api/admin/leads?${params}`),
  });
}

export function usePendingEOIs() {
  return useQuery({
    queryKey: ["admin", "pending-eois"],
    queryFn: () => fetcher<PendingEOI[]>("/api/admin/eois/pending"),
  });
}

export function usePartnerAnalytics() {
  return useQuery({
    queryKey: ["partner", "analytics"],
    queryFn: () => fetcher<Record<string, { value: number; growth: number }>>("/api/partner/analytics"),
  });
}

export function usePartnerProjects() {
  return useQuery({
    queryKey: ["partner", "projects"],
    queryFn: () => fetcher<PartnerProject[]>("/api/partner/projects"),
  });
}

export function usePartnerLeads(filters?: Record<string, string>) {
  const params = new URLSearchParams(filters);
  return useQuery({
    queryKey: ["partner", "leads", filters],
    queryFn: () => fetcher<Lead[]>(`/api/partner/leads?${params}`),
  });
}

export function usePartnerEOIs(status?: string) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return useQuery({
    queryKey: ["partner", "eois", status || "all"],
    queryFn: () => fetcher<PartnerEOI[]>(`/api/partner/eois${query}`),
  });
}

export function useCustomerDashboard(eoiId?: string | null) {
  const query = eoiId ? `?eoiId=${eoiId}` : "";
  return useQuery({
    queryKey: ["customer", "dashboard", eoiId || "default"],
    queryFn: () => fetcher<CustomerDashboard>(`/api/customer/dashboard${query}`),
  });
}

export function useCustomerEOI(eoiId?: string | null) {
  const query = eoiId ? `?eoiId=${encodeURIComponent(eoiId)}` : "";
  return useQuery({
    queryKey: ["customer", "eoi", eoiId || "default"],
    queryFn: () => fetcher<{
      id: string;
      status: string;
      formData?: Record<string, unknown>;
      submittedAt?: string | null;
      approvedAt?: string | null;
      adminRemarks?: string | null;
      rejectionReason?: string | null;
      referenceNumber?: string | null;
      confirmationNumber?: string | null;
      lead?: { customerName: string; customerEmail: string; customerMobile: string; configuration?: string; budget?: string; city?: string };
      project?: { name: string; eoiRules?: { requiredDocuments?: string[] }[] };
      documents?: Document[];
      approvalActions?: { id?: string; action: string; remarks?: string; createdAt: string }[];
    } | null>(`/api/customer/eoi${query}`),
  });
}

export function useCustomerDocuments(eoiId?: string | null) {
  const query = eoiId ? `?eoiId=${encodeURIComponent(eoiId)}` : "";
  return useQuery({
    queryKey: ["customer", "documents", eoiId || "default"],
    queryFn: () => fetcher<Document[]>(`/api/customer/documents${query}`),
  });
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { ids?: string[]; markAll?: boolean }) =>
      fetch("/api/notifications", { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}
