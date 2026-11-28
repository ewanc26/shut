import type { LabelerServer } from '@skyware/labeler';
import type { Checked } from '../profile/lookup.js';
import {
	INFLUENCED_LABEL,
	LABEL,
	type Label,
	POST_LABELS,
	PROFILE_INFLUENCED_LABEL,
	PROFILE_LABEL
} from './definition.js';
import { PROFILE, type LabelStore } from './reconcile.js';

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

/** Each post label, and the profile label that replaces it on a profile. */
const PROFILE_EQUIVALENT: Record<(typeof POST_LABELS)[number], Label> = {
	[LABEL]: PROFILE_LABEL,
	[INFLUENCED_LABEL]: PROFILE_INFLUENCED_LABEL
};

/**
 * Moves profiles labelled before profiles had labels of their own onto them: each post label is
 * withdrawn and its profile equivalent applied. Does nothing once done. Returns how many
 * profiles were moved.
 */
export async function moveProfileLabels(server: LabelerServer, store: LabelStore): Promise<number> {
	await server['dbInitLock'];
	const { rows } = await server.db.execute({
		sql: `SELECT DISTINCT uri FROM labels WHERE src = ? AND uri LIKE ? AND val IN (${POST_LABELS.map(() => '?').join(', ')})`,
		args: [server.did, `at://%/${PROFILE}/self`, ...POST_LABELS]
	});
	let moved = 0;
	for (const { uri } of rows) {
		if (typeof uri !== 'string') continue;
		let changed = false;
		for (const label of POST_LABELS) {
			const current = await store.active(uri, label);
			if (!current) continue;
			const replacement = PROFILE_EQUIVALENT[label];
			if (!(await store.active(uri, replacement))) {
				await store.apply(uri, current.cid, replacement);
			}
			await store.negate(uri, current.cid, label);
			changed = true;
		}
		if (changed) moved++;
	}
	return moved;
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
