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
      console.warn("[Email] Template sync skipped:", error);
    }
  }
}
