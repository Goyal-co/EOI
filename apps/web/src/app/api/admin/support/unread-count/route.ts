import { prisma } from "@goyal/db";
import { withAuth, apiResponse, withApiRoute } from "@/lib/api";

export const GET = withApiRoute("admin.support.unread-count", async () => {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;

  const [liveTickets, unassigned, unreadMessages] = await Promise.all([
    prisma.supportTicket.count({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
    }),
    prisma.supportTicket.count({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] }, assignedAdminId: null },
    }),
    prisma.supportMessage.count({
      where: {
        readByAdminAt: null,
        ticket: { status: { in: ["OPEN", "IN_PROGRESS"] } },
        sender: { role: { in: ["CHANNEL_PARTNER", "CP_TEAM_MEMBER"] } },
      },
    }),
  ]);

  return apiResponse({ unreadMessages, liveTickets, unassigned });
});
