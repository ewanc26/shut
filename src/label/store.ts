import type { LabelerServer } from "@skyware/labeler";
import { LABEL } from "./definition.js";
import type { LabelStore } from "./reconcile.js";

/** Backs the label store with the labeller server's own database. */
export async function serverStore(server: LabelerServer): Promise<LabelStore> {
  // The server creates its table asynchronously and exposes no public way to wait for it.
  await server["dbInitLock"];
  await server.db.execute("CREATE INDEX IF NOT EXISTS labels_subject ON labels (uri, val, id)");

  return {
    async active(uri) {
      const { rows } = await server.db.execute({
        sql: "SELECT cid, neg FROM labels WHERE uri = ? AND val = ? AND src = ? ORDER BY id DESC LIMIT 1",
        args: [uri, LABEL, server.did],
      });
      const row = rows[0];
      if (!row || row.neg) return undefined;
      return typeof row.cid === "string" ? { cid: row.cid } : {};
    },
    async apply(uri, cid) {
      await server.createLabel({ uri, cid, val: LABEL });
    },
    async negate(uri, cid) {
      await server.createLabel({ uri, cid, val: LABEL, neg: true });
    },
  };
}
