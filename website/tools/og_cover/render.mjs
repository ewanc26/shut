// Renders template.html to static/og.png: node tools/og_cover/render.mjs
// Social cards must be raster images, so the PNG is committed beside its source.
// Needs a Chrome or Chromium binary; set CHROME_PATH if it is not found.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const output = join(here, '../../static/og.png');
const require = createRequire(import.meta.url);

const chrome = [
	process.env.CHROME_PATH,
	'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
	'/usr/bin/chromium',
	'/usr/bin/google-chrome'
].find((path) => path && existsSync(path));
if (!chrome) throw new Error('No Chrome or Chromium found. Set CHROME_PATH.');

// Fonts are inlined so the browser cannot silently fall back to a system face.
const face = (family, file) =>
	`@font-face { font-family: '${family}'; font-weight: 200 800; font-stretch: 75% 100%; ` +
	`src: url(data:font/woff2;base64,${readFileSync(require.resolve(file)).toString('base64')}); }`;
const fonts = [
	face(
		'Bricolage Grotesque Variable',
		'@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-standard-normal.woff2'
	),
	face(
		'Atkinson Hyperlegible Next Variable',
		'@fontsource-variable/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-wght-normal.woff2'
	)
].join('\n');

const scratch = mkdtempSync(join(tmpdir(), 'shut-og-'));
try {
	const page = join(scratch, 'card.html');
	writeFileSync(
		page,
		readFileSync(join(here, 'template.html'), 'utf8').replace('/* @fonts */', fonts)
	);
	execFileSync(chrome, [
		'--headless',
		'--disable-gpu',
		'--hide-scrollbars',
		'--force-device-scale-factor=1',
		'--window-size=1200,630',
		'--virtual-time-budget=3000',
		`--user-data-dir=${join(scratch, 'profile')}`,
		`--screenshot=${output}`,
		pathToFileURL(page).href
	]);
	console.log(`Wrote ${output}`);
} finally {
	rmSync(scratch, { recursive: true, force: true, maxRetries: 5 });
}
