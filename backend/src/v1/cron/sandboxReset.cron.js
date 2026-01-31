import cron from "node-cron";
import restore from "../scripts/sandboxRestore";

export function startSandboxCron() {
  cron.schedule(
    "0 0 * * *",
    async () => {
      console.log("⏰ Running sandbox daily reset...");
      await restore();
    },
    {
      timezone: "Asia/Kolkata",
    }
  );
}
