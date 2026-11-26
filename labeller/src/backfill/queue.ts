// Posts the backfill found, waiting to be labelled. Holds addresses and versions, never text.
import { DatabaseSync } from 'node:sqlite';

export interface Match {
	uri: string;
	did: string;
	cid: string;
	seq: number;
}

/** One change to the queue, in the order the archive gave it. */
export type Step =
	| { save: Match }
	/** The post was deleted, or edited so that it no longer matches. */
	| { remove: string }
	/** The account was deleted. */
	| { forget: string };

export function backfillQueue(path: string) {
	const db = new DatabaseSync(path);
	db.exec(`
		PRAGMA journal_mode = WAL;
		CREATE TABLE IF NOT EXISTS matches (
			uri TEXT PRIMARY KEY, did TEXT NOT NULL, cid TEXT NOT NULL, seq INTEGER NOT NULL
		) WITHOUT ROWID;
		CREATE INDEX IF NOT EXISTS matches_did ON matches (did);
		CREATE TABLE IF NOT EXISTS progress (id INTEGER PRIMARY KEY CHECK (id = 1), seq INTEGER NOT NULL);
	`);
	const save = db.prepare(
		`INSERT INTO matches (uri, did, cid, seq) VALUES (?, ?, ?, ?)
		ON CONFLICT (uri) DO UPDATE SET cid = excluded.cid, seq = excluded.seq`
	);
	const remove = db.prepare('DELETE FROM matches WHERE uri = ?');
	const forget = db.prepare('DELETE FROM matches WHERE did = ?');
	const mark = db.prepare(
		'INSERT INTO progress (id, seq) VALUES (1, ?) ON CONFLICT (id) DO UPDATE SET seq = excluded.seq'
	);

	return {
		/** The last archive position written. Zero before the first. */
		cursor(): number {
			return Number(db.prepare('SELECT seq FROM progress').get()?.seq ?? 0);
		},
		/** Writes the changes and the position reached together, or neither. */
		write(steps: readonly Step[], seq: number): void {
			db.exec('BEGIN');
			try {
				for (const step of steps) {
					if ('save' in step) {
						const { uri, did, cid, seq: at } = step.save;
						save.run(uri, did, cid, at);
					} else if ('remove' in step) remove.run(step.remove);
					else forget.run(step.forget);
				}
				mark.run(seq);
				db.exec('COMMIT');
			} catch (error) {
				db.exec('ROLLBACK');
				throw error;
			}
		},
		size: (): number => Number(db.prepare('SELECT COUNT(*) AS n FROM matches').get()?.n),
		all: () => db.prepare('SELECT uri, did, cid, seq FROM matches ORDER BY uri').all(),
		close: () => db.close()
	};
}

export type BackfillQueue = ReturnType<typeof backfillQueue>;
