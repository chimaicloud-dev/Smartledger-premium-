import { db, passwordResetTokensTable } from "@workspace/db";
import { or, lt, isNotNull } from "drizzle-orm";

const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function cleanupExpiredResetTokens(
  log?: { info: (...a: any[]) => void; error: (...a: any[]) => void },
): Promise<void> {
  try {
    const result = await db
      .delete(passwordResetTokensTable)
      .where(
        or(
          lt(passwordResetTokensTable.expiresAt, new Date()),
          isNotNull(passwordResetTokensTable.usedAt),
        ),
      )
      .returning({ id: passwordResetTokensTable.id });

    log?.info({ deleted: result.length }, "resetTokens.cleanup");
  } catch (err) {
    log?.error({ err }, "resetTokens.cleanup.error");
  }
}

export function scheduleResetTokenCleanup(
  log?: { info: (...a: any[]) => void; error: (...a: any[]) => void },
): void {
  // Run once immediately on startup, then every 24 hours
  void cleanupExpiredResetTokens(log);
  setInterval(() => void cleanupExpiredResetTokens(log), CLEANUP_INTERVAL_MS).unref();
}
