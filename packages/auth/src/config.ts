import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma, isUniqueConstraintError } from "@goyal/db";
import type { UserRole } from "@goyal/types";
import { normalizeEmail } from "@goyal/types";
import { logger, redactEmail } from "@goyal/logger";
import { authConfig } from "./auth.config";

function authWarn(msg: string, fields?: Record<string, unknown>) {
  logger.warn("auth.credentials", msg, { method: "POST", path: "/api/auth", ...fields });
}

function authInfo(msg: string, fields?: Record<string, unknown>) {
  logger.info("auth.credentials", msg, { method: "POST", path: "/api/auth", ...fields });
}

function googleWarn(msg: string, fields?: Record<string, unknown>) {
  logger.warn("auth.google", msg, fields);
}

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
      teamMemberId?: string;
      jobRole?: "SALES_EXECUTIVE" | "TEAM_LEADER" | null;
    };
  }

  interface User {
    role: UserRole;
    status: string;
    cpId?: string;
    cpStatus?: string;
    customerId?: string;
    teamMemberId?: string;
    jobRole?: "SALES_EXECUTIVE" | "TEAM_LEADER" | null;
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
        portal: { label: "Portal", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = normalizeEmail(String(credentials.email));
        const portal = String(credentials.portal || "").toLowerCase() || "unknown";
        const user = await prisma.user.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
          include: {
            cpProfile: true,
            customerProfile: true,
            teamMemberProfile: { include: { cp: true } },
          },
        });

        if (!user || !user.passwordHash) {
          authWarn("login failed: user not found or has no password", {
            portal,
            email: redactEmail(email),
          });
          return null;
        }

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!valid) {
          authWarn("login failed: invalid password", { portal, email: redactEmail(email) });
          return null;
        }

        const expectedRole: Record<string, UserRole> = {
          admin: "ADMIN",
          partner: "CHANNEL_PARTNER",
          customer: "CUSTOMER",
        };
        if (portal === "partner") {
          if (user.role !== "CHANNEL_PARTNER" && user.role !== "CP_TEAM_MEMBER") {
            authWarn("login failed: wrong portal for role", {
              portal,
              email: redactEmail(email),
              role: user.role,
            });
            return null;
          }
        } else if (portal && expectedRole[portal] && user.role !== expectedRole[portal]) {
          authWarn("login failed: wrong portal for role", {
            portal,
            email: redactEmail(email),
            role: user.role,
          });
          return null;
        }

        if (user.status !== "ACTIVE" && user.status !== "PENDING") {
          authWarn("login failed: account status not allowed", {
            portal,
            email: redactEmail(email),
            status: user.status,
          });
          return null;
        }

        if (user.role === "CHANNEL_PARTNER") {
          if (user.cpProfile?.status === "BLOCKED") {
            authWarn("login failed: channel partner blocked", {
              portal,
              email: redactEmail(email),
            });
            return null;
          }
          if (user.cpProfile?.status !== "APPROVED") {
            authWarn("login failed: channel partner not approved", {
              portal,
              email: redactEmail(email),
              cpStatus: user.cpProfile?.status || "missing",
            });
            return null;
          }
        }

        if (user.role === "CP_TEAM_MEMBER") {
          let teamMember = user.teamMemberProfile;
          if (!teamMember) {
            teamMember = await prisma.cPTeamMember.findFirst({
              where: { userId: user.id },
              include: { cp: true },
            });
          }
          if (!teamMember || teamMember.status !== "ACTIVE") {
            authWarn("login failed: team member inactive", {
              portal,
              email: redactEmail(email),
            });
            return null;
          }
          if (teamMember.cp.status === "BLOCKED" || teamMember.cp.status !== "APPROVED") {
            authWarn("login failed: parent channel partner not approved", {
              portal,
              email: redactEmail(email),
              cpStatus: teamMember.cp.status,
            });
            return null;
          }
          authInfo("login success", {
            portal,
            email: redactEmail(email),
            role: user.role,
            userId: user.id,
          });
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            role: user.role as UserRole,
            status: user.status,
            cpId: teamMember.cpId,
            cpStatus: teamMember.cp.status,
            customerId: user.customerProfile?.id,
            teamMemberId: teamMember.id,
            jobRole: (teamMember as { jobRole?: "SALES_EXECUTIVE" | "TEAM_LEADER" }).jobRole ?? "SALES_EXECUTIVE",
          };
        }

        authInfo("login success", {
          portal,
          email: redactEmail(email),
          role: user.role,
          userId: user.id,
        });
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role as UserRole,
          status: user.status,
          cpId: user.cpProfile?.id ?? user.teamMemberProfile?.cpId,
          cpStatus: user.cpProfile?.status ?? user.teamMemberProfile?.cp.status,
          customerId: user.customerProfile?.id,
          teamMemberId: user.teamMemberProfile?.id,
          jobRole: (user.teamMemberProfile as { jobRole?: "SALES_EXECUTIVE" | "TEAM_LEADER" } | null | undefined)?.jobRole ?? null,
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
            if (!linkedLead) {
              googleWarn("google sign-in denied: customer has no accepted EOI lead", {
                email: redactEmail(email),
              });
              return "/customer/login?error=AccessDenied";
            }
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
            googleWarn("google sign-in denied: email registered as partner", {
              email: redactEmail(email),
            });
            return "/customer/login?error=EmailRegisteredAsPartner";
          }
          googleWarn("google sign-in denied: email already registered", {
            email: redactEmail(email),
            role: existingUser.role,
          });
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
              googleWarn("google sign-in denied: unique email constraint", {
                email: redactEmail(email),
              });
              return "/customer/login?error=EmailAlreadyRegistered";
            }
            logger.error(
              "auth.google",
              "google customer create failed",
              { email: redactEmail(email) },
              error,
            );
            throw error;
          }
        }

        googleWarn("google sign-in denied: no invited EOI lead", {
          email: redactEmail(email),
        });
        return "/customer/login?error=AccessDenied";
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.email && process.env.NEXT_RUNTIME !== "edge") {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
          include: {
            cpProfile: true,
            customerProfile: true,
            teamMemberProfile: { include: { cp: true } },
          },
        });
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role as UserRole;
          token.status = dbUser.status;
          token.cpId = dbUser.cpProfile?.id ?? dbUser.teamMemberProfile?.cpId;
          token.cpStatus = dbUser.cpProfile?.status ?? dbUser.teamMemberProfile?.cp.status;
          token.customerId = dbUser.customerProfile?.id;
          token.teamMemberId = dbUser.teamMemberProfile?.id;
          token.jobRole = dbUser.teamMemberProfile?.jobRole ?? null;
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
        token.teamMemberId = user.teamMemberId;
        token.jobRole = user.jobRole;
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

      if (
        process.env.NEXT_RUNTIME !== "edge"
        && token.id
        && token.role === "CP_TEAM_MEMBER"
      ) {
        const teamMember = await prisma.cPTeamMember.findFirst({
          where: { userId: token.id as string, status: "ACTIVE" },
          include: { cp: { select: { id: true, status: true } } },
        });
        if (teamMember) {
          token.cpId = teamMember.cpId;
          token.cpStatus = teamMember.cp.status;
          token.teamMemberId = teamMember.id;
          token.jobRole = teamMember.jobRole;
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
        session.user.teamMemberId = token.teamMemberId as string | undefined;
        session.user.jobRole = token.jobRole as "SALES_EXECUTIVE" | "TEAM_LEADER" | null | undefined;
      }
      return session;
    },
  },
});

export const isGoogleAuthConfigured = () => googleConfigured;
