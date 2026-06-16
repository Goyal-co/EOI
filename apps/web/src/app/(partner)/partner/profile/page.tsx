"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardHeader, CardTitle, CardContent, Input, Button, StatusBadge, useToast, PageHeader, FormField } from "@goyal/ui";
import { User, Building2 } from "lucide-react";

export default function PartnerProfilePage() {
  const { data: session, update } = useSession();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [personal, setPersonal] = useState({
    name: "",
    email: "",
    mobile: "",
  });
  const [company, setCompany] = useState({
    companyName: "",
    reraNumber: "",
    panNumber: "",
    gstNumber: "",
    officeAddress: "",
    city: "",
  });

  useEffect(() => {
    fetch("/api/partner/profile")
      .then((res) => res.json())
      .then((data) => {
        setPersonal({
          name: data.name || "",
          email: data.email || "",
          mobile: data.mobile || "",
        });
        setCompany({
          companyName: data.companyName || "",
          reraNumber: data.reraNumber || "",
          panNumber: data.panNumber || "",
          gstNumber: data.gstNumber || "",
          officeAddress: data.officeAddress || "",
          city: data.city || "",
        });
      })
      .catch(() => {});
  }, []);

  const saveProfile = async (payload: Record<string, string | undefined>) => {
    setLoading(true);
    try {
      const res = await fetch("/api/partner/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      if (payload.name) await update({ name: payload.name });
      addToast({ type: "success", title: "Profile updated" });
    } catch (err) {
      addToast({ type: "error", title: "Save failed", message: err instanceof Error ? err.message : "Try again" });
    } finally {
      setLoading(false);
    }
  };

  const handleSavePersonal = () => saveProfile({ name: personal.name, mobile: personal.mobile });
  const handleSaveCompany = () => saveProfile(company);

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" description="Manage your personal and company information" />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <StatusBadge status={session?.user?.status || "ACTIVE"} />
          </div>
          <FormField label="Full Name" htmlFor="partner-name">
            <Input id="partner-name" value={personal.name} onChange={(e) => setPersonal({ ...personal, name: e.target.value })} />
          </FormField>
          <FormField label="Email" htmlFor="partner-email">
            <Input id="partner-email" value={personal.email} disabled />
          </FormField>
          <FormField label="Mobile" htmlFor="partner-mobile">
            <Input id="partner-mobile" value={personal.mobile} onChange={(e) => setPersonal({ ...personal, mobile: e.target.value })} placeholder="10-digit mobile" />
          </FormField>
          <Button variant="gold" loading={loading} onClick={handleSavePersonal}>Save Personal Info</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Company Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField label="Company Name" htmlFor="company-name">
            <Input id="company-name" value={company.companyName} onChange={(e) => setCompany({ ...company, companyName: e.target.value })} />
          </FormField>
          <FormField label="RERA Number" htmlFor="rera-number">
            <Input id="rera-number" value={company.reraNumber} onChange={(e) => setCompany({ ...company, reraNumber: e.target.value })} />
          </FormField>
          <FormField label="PAN Number" htmlFor="pan-number">
            <Input id="pan-number" value={company.panNumber} onChange={(e) => setCompany({ ...company, panNumber: e.target.value.toUpperCase() })} />
          </FormField>
          <FormField label="GST Number" htmlFor="gst-number">
            <Input id="gst-number" value={company.gstNumber} onChange={(e) => setCompany({ ...company, gstNumber: e.target.value })} />
          </FormField>
          <FormField label="Office Address" htmlFor="office-address">
            <Input id="office-address" value={company.officeAddress} onChange={(e) => setCompany({ ...company, officeAddress: e.target.value })} />
          </FormField>
          <FormField label="City" htmlFor="company-city">
            <Input id="company-city" value={company.city} onChange={(e) => setCompany({ ...company, city: e.target.value })} />
          </FormField>
          <Button variant="gold" loading={loading} onClick={handleSaveCompany}>Save Company Info</Button>
        </CardContent>
      </Card>
    </div>
  );
}
