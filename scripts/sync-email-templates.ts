import { syncDefaultEmailTemplates } from "../packages/email/src/template-loader";

async function main() {
  const result = await syncDefaultEmailTemplates({ forceLeadEoiTemplates: true });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
