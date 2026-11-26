import type { LabelerServer } from '@skyware/labeler';
import type { Checked } from '../profile/lookup.js';
import type { LabelStore } from './reconcile.js';

/** Backs the label store with the labeller server's own database. */
export async function serverStore(server: LabelerServer): Promise<LabelStore> {
	// The server creates its table asynchronously and exposes no public way to wait for it.
	await server['dbInitLock'];
	await server.db.execute('CREATE INDEX IF NOT EXISTS labels_subject ON labels (uri, val, id)');

	return {
		async active(uri, label) {
			const { rows } = await server.db.execute({
				sql: 'SELECT cid, neg FROM labels WHERE uri = ? AND val = ? AND src = ? ORDER BY id DESC LIMIT 1',
				args: [uri, label, server.did]
			});
			const row = rows[0];
			if (!row || row.neg) return undefined;
			return typeof row.cid === 'string' ? { cid: row.cid } : {};
		},
		async apply(uri, cid, label) {
			await server.createLabel({ uri, cid, val: label });
		},
		async negate(uri, cid, label) {
			await server.createLabel({ uri, cid, val: label, neg: true });
		}
	};
}

/** Remembers, across restarts, which accounts have had their profile judged. */
export async function checkedProfiles(server: LabelerServer): Promise<Checked> {
	await server['dbInitLock'];
	await server.db.execute(
		'CREATE TABLE IF NOT EXISTS checked_profiles (did TEXT PRIMARY KEY) WITHOUT ROWID'
	);

	return {
		async has(did) {
			const { rows } = await server.db.execute({
				sql: 'SELECT 1 FROM checked_profiles WHERE did = ?',
				args: [did]
			});
			return rows.length > 0;
		},
		async add(did) {
			await server.db.execute({
				sql: 'INSERT OR IGNORE INTO checked_profiles (did) VALUES (?)',
				args: [did]
			});
		}
	};
}
