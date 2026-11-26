// Sends label history to subscribers in batches. The library's own handler loads every label
// into memory and sends them all at once, which a large backfill would turn into a way to
// exhaust the labeller.
import { encode, toBytes } from '@atcute/cbor';
import type { LabelerServer } from '@skyware/labeler';
import { paced } from './pace.js';

export const BATCH_SIZE = 500;
/** No further batch is read while a subscriber has this many bytes waiting. */
export const BUFFER_LIMIT = 1_000_000;
/**
 * The most new labels announced in a second. Bluesky's AppView documents a limit of 5, which
 * catching up after a pause could otherwise pass.
 */
export const LIVE_PER_SECOND = 4;
const DRAIN_MS = 20;
const OPEN = 1;
const CHANNEL = 'com.atproto.label.subscribeLabels';

type Socket = Parameters<LabelerServer['subscribeLabelsHandler']>[0];

function frame(header: object, body: object): Uint8Array {
	const [a, b] = [encode(header), encode(body)];
	const bytes = new Uint8Array(a.length + b.length);
	bytes.set(a);
	bytes.set(b, a.length);
	return bytes;
}

interface Saved {
	src: string;
	uri: string;
	val: string;
	cts: string;
	cid?: unknown;
	exp?: unknown;
	neg?: unknown;
	sig?: unknown;
}

/** One `#labels` message, the same for stored rows and freshly signed labels. */
function message(seq: number, { src, uri, cid, val, neg, cts, exp, sig }: Saved): Uint8Array {
	if (!(sig instanceof ArrayBuffer || sig instanceof Uint8Array)) {
		throw new Error(`Label ${seq} has no signature.`);
	}
	const label = {
		ver: 1,
		src,
		uri,
		val,
		cts,
		neg: Boolean(neg),
		sig: toBytes(new Uint8Array(sig)),
		...(cid ? { cid } : {}),
		...(exp ? { exp } : {})
	};
	return frame({ op: 1, t: '#labels' }, { seq, labels: [label] });
}

/**
 * Replaces the server's subscription handler. Call it straight after creating the server,
 * before its routes are registered.
 */
export function batchedReplay(
	server: LabelerServer,
	batchSize = BATCH_SIZE,
	perSecond = LIVE_PER_SECOND
): void {
	const announce = paced(1000 / perSecond);
	/** The last label each subscriber was sent from history, so live delivery never repeats it. */
	const replayed = new WeakMap<Socket, number>();
	let newest = 0;

	server['emitLabel'] = (seq: number, label: Saved) => {
		newest = Math.max(newest, seq);
		const bytes = message(seq, label);
		// Who still needs it is decided when it is sent: a replay may have covered it by then.
		announce(() => {
			server['connections'].get(CHANNEL)?.forEach((socket: Socket) => {
				if (seq > (replayed.get(socket) ?? 0)) socket.send(bytes);
			});
		});
	};

	const fail = (socket: Socket, error: string, text: string) => {
		socket.send(frame({ op: -1 }, { error, message: text }));
		socket.terminate();
	};

	/** Resolves false once the subscriber has gone. */
	async function drained(socket: Socket): Promise<boolean> {
		while (socket.readyState === OPEN && socket.bufferedAmount > BUFFER_LIMIT) {
			await new Promise((resolve) => setTimeout(resolve, DRAIN_MS));
		}
		return socket.readyState === OPEN;
	}

	async function replay(socket: Socket, from: number, caughtUp: () => void): Promise<void> {
		let cursor = from;
		for (;;) {
			if (!(await drained(socket))) return;
			const { rows } = await server.db.execute({
				sql: 'SELECT * FROM labels WHERE id > ? ORDER BY id LIMIT ?',
				args: [cursor, batchSize]
			});
			for (const row of rows) {
				cursor = Number(row.id);
				socket.send(message(cursor, row as unknown as Saved));
			}
			replayed.set(socket, cursor);
			// A label saved since the query was not sent live, so go round again for it. Nothing
			// may be awaited between this check and subscribing.
			if (rows.length < batchSize && newest <= cursor) {
				if (socket.readyState === OPEN) caughtUp();
				return;
			}
		}
	}

	server.subscribeLabelsHandler = async (socket, request) => {
		const subscribe = () => {
			server['addSubscription'](CHANNEL, socket);
			socket.on('close', () => server['removeSubscription'](CHANNEL, socket));
		};
		try {
			await server['dbInitLock'];
			const { cursor } = request.query;
			if (!cursor) return subscribe();
			const from = Number(cursor);
			if (!Number.isInteger(from)) {
				return fail(socket, 'InvalidRequest', 'Cursor must be an integer');
			}
			const latest = await server.db.execute('SELECT MAX(id) AS id FROM labels');
			if (from > Number(latest.rows[0]?.id ?? 0)) {
				return fail(socket, 'FutureCursor', 'Cursor is in the future');
			}
			await replay(socket, from, subscribe);
		} catch (error) {
			console.error('Could not replay labels:', error);
			fail(socket, 'InternalServerError', 'An unknown error occurred');
		}
	};
}
