/**
 * Backfill CPTeamMember rows from distinct Lead.fosName values per CP.
 * Run: pnpm --filter @goyal/db exec tsx scripts/backfill-team-members.ts
 */
import { prisma } from "../src";

async function main() {
  const leads = await prisma.lead.findMany({
    where: { fosName: { not: null } },
    select: { id: true, cpId: true, fosName: true },
  });

  const rosterMap = new Map<string, string>(); // key: cpId|name -> memberId

  for (const lead of leads) {
    const name = (lead.fosName || "").trim();
    if (!name) continue;
    const key = `${lead.cpId}|${name.toLowerCase()}`;

    let memberId = rosterMap.get(key);
    if (!memberId) {
      const existing = await prisma.cPTeamMember.findFirst({
        where: { cpId: lead.cpId, name: { equals: name, mode: "insensitive" } },
      });
      if (existing) {
        memberId = existing.id;
      } else {
        const created = await prisma.cPTeamMember.create({
          data: { cpId: lead.cpId, name, role: "FOS" },
        });
        memberId = created.id;
        console.log(`Created team member: ${name} for CP ${lead.cpId}`);
      }
      rosterMap.set(key, memberId);
    }

    await prisma.lead.update({
      where: { id: lead.id },
      data: { teamMemberId: memberId },
    });
  }

  console.log(`Backfill complete. Processed ${leads.length} leads, ${rosterMap.size} team members.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
