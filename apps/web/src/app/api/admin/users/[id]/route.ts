import { prisma } from "@goyal/db";
import { withAuth, apiResponse, apiError, withApiRoute } from "@/lib/api";

export const PATCH = withApiRoute("admin.users.id.patch", async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { error, session } = await withAuth(["ADMIN"]);
  if (error) return error;
  const { id } = await params;

  if (id === session!.user.id) {
    return apiError("Cannot deactivate your own account", 400);
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.role !== "ADMIN") return apiError("Admin user not found", 404);

  const body = await req.json();
  const status = body.status === "INACTIVE" ? "INACTIVE" : "ACTIVE";

  const updated = await prisma.user.update({
    where: { id },
    data: { status },
    select: { id: true, name: true, email: true, status: true },
  });

  return apiResponse(updated);
});
