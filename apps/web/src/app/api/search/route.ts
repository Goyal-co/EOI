import { prisma } from "@goyal/db";
import { withAuth, apiResponse } from "@/lib/api";
import type { UserRole } from "@goyal/types";

interface SearchResult {
  type: string;
  id: string;
  label: string;
  href: string;
}

export async function GET(req: Request) {
  const { error, session } = await withAuth();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  if (q.length < 2) return apiResponse({ results: [] });

  const role = session!.user.role as UserRole;
  const results: SearchResult[] = [];

  if (role === "ADMIN") {
    const [projects, cps, leads, eois] = await Promise.all([
      prisma.project.findMany({
        where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { location: { contains: q, mode: "insensitive" } }] },
        take: 5,
        select: { id: true, name: true },
      }),
      prisma.channelPartner.findMany({
        where: { OR: [{ user: { name: { contains: q, mode: "insensitive" } } }, { user: { email: { contains: q, mode: "insensitive" } } }] },
        take: 5,
        include: { user: { select: { name: true } } },
      }),
      prisma.lead.findMany({
        where: { OR: [{ customerName: { contains: q, mode: "insensitive" } }, { customerEmail: { contains: q, mode: "insensitive" } }] },
        take: 5,
        select: { id: true, customerName: true },
      }),
      prisma.eOI.findMany({
        where: { OR: [{ referenceNumber: { contains: q, mode: "insensitive" } }, { lead: { customerName: { contains: q, mode: "insensitive" } } }] },
        take: 5,
        include: { lead: { select: { customerName: true } } },
      }),
    ]);

    results.push(
      ...projects.map((p) => ({ type: "project", id: p.id, label: p.name, href: "/admin/projects" })),
      ...cps.map((c) => ({ type: "cp", id: c.id, label: c.user.name || "CP", href: "/admin/channel-partners" })),
      ...leads.map((l) => ({ type: "lead", id: l.id, label: l.customerName, href: "/admin/leads" })),
      ...eois.map((e) => ({ type: "eoi", id: e.id, label: e.referenceNumber || e.lead.customerName, href: "/admin/eois" })),
    );
  }

  if (role === "CHANNEL_PARTNER" && session!.user.cpId) {
    const cpId = session!.user.cpId;
    const [projects, leads] = await Promise.all([
      prisma.cPProjectAccess.findMany({
        where: { cpId, project: { name: { contains: q, mode: "insensitive" } } },
        take: 5,
        include: { project: { select: { id: true, name: true } } },
      }),
      prisma.lead.findMany({
        where: {
          cpId,
          OR: [{ customerName: { contains: q, mode: "insensitive" } }, { customerEmail: { contains: q, mode: "insensitive" } }],
        },
        take: 5,
        select: { id: true, customerName: true },
      }),
    ]);

    results.push(
      ...projects.map((a) => ({ type: "project", id: a.project.id, label: a.project.name, href: `/partner/projects/${a.project.id}` })),
      ...leads.map((l) => ({ type: "lead", id: l.id, label: l.customerName, href: "/partner/leads" })),
    );
  }

  if (role === "CUSTOMER") {
    const eois = await prisma.eOI.findMany({
      where: {
        customer: { userId: session!.user.id },
        OR: [{ referenceNumber: { contains: q, mode: "insensitive" } }, { project: { name: { contains: q, mode: "insensitive" } } }],
      },
      take: 5,
      include: { project: { select: { name: true } } },
    });
    results.push(
      ...eois.map((e) => ({ type: "eoi", id: e.id, label: e.referenceNumber || e.project.name, href: "/customer/my-eoi" })),
    );
  }

  return apiResponse({ results: results.slice(0, 10) });
}
