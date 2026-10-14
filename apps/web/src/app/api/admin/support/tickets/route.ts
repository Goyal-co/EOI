import { prisma } from "@goyal/db";
import { withAuth, apiResponse, withApiRoute } from "@/lib/api";
import { mapTicketListItem } from "@/lib/services/support";

export const GET = withApiRoute("admin.support.tickets.list", async (req: Request) => {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const q = url.searchParams.get("q")?.trim().toLowerCase() || "";

  const tickets = await prisma.supportTicket.findMany({
    where: {
      ...(status && status !== "ALL" ? { status: status as "OPEN" | "IN_PROGRESS" | "RESOLVED" } : {}),
    },
    include: {
      cp: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      project: { select: { id: true, name: true } },
      assignedAdmin: { select: { id: true, name: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { sender: { select: { role: true } } },
      },
    },
    orderBy: { lastMessageAt: "desc" },
    take: 500,
  });

  let mapped = tickets.map(mapTicketListItem);
  if (q) {
    mapped = mapped.filter((t) => {
      const hay = [
        t.number,
        t.partner.name,
        t.partner.email,
        t.partner.companyName,
        t.categoryLabel,
        t.lastMessagePreview,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  const [openCount, unassigned] = await Promise.all([
    prisma.supportTicket.count({ where: { status: "OPEN" } }),
    prisma.supportTicket.count({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] }, assignedAdminId: null },
    }),
  ]);

  return apiResponse({
    tickets: mapped,
    meta: { openCount, unassigned, total: mapped.length },
  });
});
