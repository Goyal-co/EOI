import bcrypt from "bcryptjs";
import { prisma } from "@goyal/db";
import { adminUserCreateSchema } from "@goyal/types";
import { withAuth, apiResponse, apiError } from "@/lib/api";

export async function GET() {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true, name: true, email: true, status: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return apiResponse(admins);
}

export async function POST(req: Request) {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;

  const body = await req.json();
  const parsed = adminUserCreateSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0].message);

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return apiError("Email already registered", 409);

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      name: parsed.data.name,
      role: "ADMIN",
      status: "ACTIVE",
      passwordHash,
      adminProfile: { create: {} },
    },
    select: { id: true, name: true, email: true, status: true },
  });

  return apiResponse(user, 201);
}
