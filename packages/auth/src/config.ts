import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma, isUniqueConstraintError } from "@goyal/db";
import type { UserRole } from "@goyal/types";
import { normalizeEmail } from "@goyal/types";
import { authConfig } from "./auth.config";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: UserRole;
      status: string;
      cpId?: string;
      cpStatus?: string;
      customerId?: string;
    };
  }

  interface User {
    role: UserRole;
    status: string;
    cpId?: string;
    cpStatus?: string;
    customerId?: string;
  }
}

const googleConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim()
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    ...(googleConfigured
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: {
            cpProfile: true,
            customerProfile: true,
          },
        });

        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!valid) return null;

        if (user.status !== "ACTIVE" && user.status !== "PENDING") return null;

        if (user.role === "CHANNEL_PARTNER") {
          if (user.cpProfile?.status === "BLOCKED") return null;
          if (user.cpProfile?.status !== "APPROVED") return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role as UserRole,
          status: user.status,
          cpId: user.cpProfile?.id,
          cpStatus: user.cpProfile?.status,
          customerId: user.customerProfile?.id,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        const rawEmail = user.email || (profile as { email?: string })?.email;
        if (!rawEmail) return false;
        const email = normalizeEmail(rawEmail);

        const existingUser = await prisma.user.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
          include: { cpProfile: true, customerProfile: true },
        });

        if (existingUser) {
          if (existingUser.role === "CUSTOMER") {
            const linkedLead = await prisma.lead.findFirst({
              where: {
                customerEmail: { equals: email, mode: "insensitive" },
                confirmationStatus: "ACCEPTED",
                intentType: "EOI",
              },
              include: { eoi: true },
            });
            if (!linkedLead) return "/customer/login?error=AccessDenied";
            if (!existingUser.googleId) {
              await prisma.user.update({
                where: { id: existingUser.id },
                data: { googleId: account.providerAccountId, image: user.image },
              });
            }
            const draftableJourney = ["ACTIVE", "CONFIRMATION_PENDING"];
            const draftableEoi = ["PENDING_SUBMISSION", "ACTIVE"];
            if (draftableJourney.includes(linkedLead.journeyStatus)) {
              await prisma.lead.update({
                where: { id: linkedLead.id },
                data: { journeyStatus: "DRAFT" },
              });
            }
            if (linkedLead.eoi && draftableEoi.includes(linkedLead.eoi.status)) {
              await prisma.eOI.update({
                where: { id: linkedLead.eoi.id },
                data: { status: "DRAFT" },
              });
            }
            return true;
          }
          if (existingUser.role === "CHANNEL_PARTNER") {
            return "/customer/login?error=EmailRegisteredAsPartner";
          }
          return "/customer/login?error=EmailAlreadyRegistered";
        }

        const inviteLead = await prisma.lead.findFirst({
          where: {
            customerEmail: { equals: email, mode: "insensitive" },
            confirmationStatus: "ACCEPTED",
            intentType: "EOI",
          },
          include: { eoi: true },
        });

        if (inviteLead) {
          try {
            const newUser = await prisma.user.create({
              data: {
                email,
                googleId: account.providerAccountId,
                role: "CUSTOMER",
                name: inviteLead.customerName,
                image: user.image,
                status: "ACTIVE",
                customerProfile: {
                  create: {
                    fullName: inviteLead.customerName,
                    mobile: inviteLead.customerMobile,
                  },
                },
              },
              include: { customerProfile: true },
            });

            if (newUser.customerProfile) {
              await prisma.lead.update({
                where: { id: inviteLead.id },
                data: {
                  customerId: newUser.customerProfile.id,
                  journeyStatus: "DRAFT",
                },
              });
              if (inviteLead.eoi) {
                await prisma.eOI.update({
                  where: { id: inviteLead.eoi.id },
                  data: {
                    customerId: newUser.customerProfile.id,
                    status: "DRAFT",
                  },
                });
              }
            }
            return true;
          } catch (error) {
            if (isUniqueConstraintError(error, "email")) {
              return "/customer/login?error=EmailAlreadyRegistered";
            }
            throw error;
          }
        }

        return "/customer/login?error=AccessDenied";
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.email && process.env.NEXT_RUNTIME !== "edge") {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
          include: { cpProfile: true, customerProfile: true },
        });
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role as UserRole;
          token.status = dbUser.status;
          token.cpId = dbUser.cpProfile?.id;
          token.cpStatus = dbUser.cpProfile?.status;
          token.customerId = dbUser.customerProfile?.id;
          token.email = dbUser.email;
          token.name = dbUser.name ?? user.name;
          token.picture = dbUser.image ?? user.image;
        }
      } else if (user) {
        token.id = user.id!;
        token.role = user.role;
        token.status = user.status;
        token.cpId = user.cpId;
        token.cpStatus = user.cpStatus;
        token.customerId = user.customerId;
      }

      if (
        process.env.NEXT_RUNTIME !== "edge"
        && token.id
        && token.role === "CHANNEL_PARTNER"
      ) {
        const cp = await prisma.channelPartner.findUnique({
          where: { userId: token.id as string },
          select: { id: true, status: true },
        });
        if (cp) {
          token.cpId = cp.id;
          token.cpStatus = cp.status;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.status = token.status as string;
        session.user.cpId = token.cpId as string | undefined;
        session.user.cpStatus = token.cpStatus as string | undefined;
        session.user.customerId = token.customerId as string | undefined;
      }
      return session;
    },
  },
});

export const isGoogleAuthConfigured = () => googleConfigured;
