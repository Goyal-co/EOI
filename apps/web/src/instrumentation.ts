export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./lib/env");
    try {
      const { syncDefaultEmailTemplates } = await import("@goyal/email");
      const result = await syncDefaultEmailTemplates({ forceLeadEoiTemplates: true });
      if (result.created || result.updated) {
        console.info(
          `[Email] Synced templates — created ${result.created}, updated ${result.updated}`,
        );
      }
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String((error as { code?: string }).code) : "";
      if (code === "P2021") {
        console.info("[Email] Template sync skipped until schema is applied");
      } else {
        console.warn("[Email] Template sync skipped");
      }
    }
  }
}
