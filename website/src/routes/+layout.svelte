<script lang="ts">
	import { DESCRIPTION, REPO_URL, SITE_URL, TITLE } from '#lib/site/config.js';
	import './layout.css';

	let { children } = $props();
	const image = `${SITE_URL}/og.png`;
	const imageAlt = 'A red hanging shop sign reading “Sorry, we’re shut”.';
</script>

<svelte:head>
	<title>{TITLE}</title>
	<meta name="description" content={DESCRIPTION} />
	<link rel="canonical" href="{SITE_URL}/" />
	<meta property="og:type" content="website" />
	<meta property="og:locale" content="en_GB" />
	<meta property="og:site_name" content="shut" />
	<meta property="og:url" content="{SITE_URL}/" />
	<meta property="og:title" content={TITLE} />
	<meta property="og:description" content={DESCRIPTION} />
	<meta property="og:image" content={image} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content={imageAlt} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:image" content={image} />
	<meta name="twitter:image:alt" content={imageAlt} />
</svelte:head>

<a class="skip" href="#main-content">Skip to content</a>

<header class="wrap flex flex-wrap items-baseline justify-between gap-4 py-5">
	<a href="/" class="font-(family-name:--font-sign) text-3xl font-extrabold no-underline">shut</a>
	<nav aria-label="Main" class="flex gap-5">
		<a href="#hidden">What’s hidden</a>
		<a href="#subscribe">Subscribe</a>
		<a href={REPO_URL}>Source</a>
	</nav>
</header>

{@render children()}

<footer class="bg-paint-deep">
	<div class="wrap grid gap-8 py-12 sm:grid-cols-2">
		<div>
			<h2 class="mb-3 text-2xl!">Privacy</h2>
			<p>
				This page sets no cookies and has no analytics. What you type in the box stays in your
				browser. The web host may keep ordinary request logs.
			</p>
			<p class="mt-3">
				The labeller reads public posts. It stores the labels it makes and its place in the stream,
				not post text. Its logs note which posts were labelled and which rules matched.
			</p>
		</div>
		<div>
			<h2 class="mb-3 text-2xl!">About</h2>
			<p>
				Made by <a href="https://ewancroft.uk">Ewan Croft</a>.
				<a href={REPO_URL}>Source on GitHub</a>, under the
				<a href="{REPO_URL}/blob/main/LICENSE">MIT licence</a>.
			</p>
			<p class="mt-3">
				Support the work on <a href="https://ko-fi.com/ewancroft">Ko-fi</a>,
				<a href="https://github.com/sponsors/ewanc26">GitHub Sponsors</a> or
				<a href="https://liberapay.com/ewanc26/">Liberapay</a>.
			</p>
			<p class="mt-3 text-base">
				An independent project, not affiliated with or endorsed by Bluesky Social PBC.
			</p>
		</div>
	</div>
</footer>
