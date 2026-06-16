import { prisma } from "@goyal/db";
import { customerProfileSchema } from "@goyal/types";
import { withAuth, apiResponse, apiError } from "@/lib/api";
export async function GET() {
  const { error, session } = await withAuth(["CUSTOMER"]);
  if (error) return error;

  const customer = await prisma.customer.findUnique({
    where: { userId: session!.user.id },
    include: { user: { select: { email: true, name: true, image: true } } },
  });

  return apiResponse(customer);
}

export async function PUT(req: Request) {
  const { error, session } = await withAuth(["CUSTOMER"]);
  if (error) return error;

  const body = await req.json();
  const parsed = customerProfileSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0].message);

  const customer = await prisma.customer.update({
    where: { userId: session!.user.id },
    data: parsed.data,
  });

  await prisma.user.update({
    where: { id: session!.user.id },
    data: { name: parsed.data.fullName },
  });
  return apiResponse(customer);
}
