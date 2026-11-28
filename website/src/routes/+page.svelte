<script lang="ts">
	import { detect, WEAK_THRESHOLD } from 'shut-labeller/detect';
	import { STRONG_REASONS, TEMPLATE_REASONS, WEAK_REASONS } from '#lib/judge/reasons.js';
	import DoorSign from '#lib/sign/door_sign.svelte';
	import { LABELLER_HANDLE, REPO_URL } from '#lib/site/config.js';

	const examples = [
		'Cancel my Excel subscription',
		'Total blackpill moment',
		'How do you cope with night shifts?'
	];

	let text = $state('');
	const verdict = $derived(detect([text]));
	const reasons = $derived([
		...new Set([
			...verdict.strong.map((id) => STRONG_REASONS[id] ?? id),
			...verdict.weak.map((group) => WEAK_REASONS[group] ?? group),
			...verdict.template.map((id) => TEMPLATE_REASONS[id] ?? id)
		])
	]);
	const summary = $derived.by(() => {
		if (!text.trim()) return 'Nothing typed yet.';
		if (verdict.matched) return 'shut would label this, and subscribers would not see it.';
		if (verdict.strict && !verdict.weak.length)
			return 'Only the incel influenced language label would apply. Coinages and broad words are not enough for the incel language label.';
		if (verdict.strict)
			return `Only the incel influenced language label would apply. One ambiguous match is not enough for the incel language label; it takes ${WEAK_THRESHOLD} different kinds.`;
		return 'Left alone.';
	});
</script>

<main id="main-content">
	<section class="wrap grid items-center gap-x-14 gap-y-10 pt-6 pb-20 lg:grid-cols-[1.15fr_1fr]">
		<div>
			<h1>Shut the door on incel language.</h1>
			<p class="mt-5 max-w-[34rem] text-xl">
				shut is a labeller for Bluesky. Subscribe to it, and posts using incel vocabulary are hidden
				from you. You can switch that to a warning at any time.
			</p>
		</div>

		<div class="lg:row-span-2">
			<DoorSign shut={verdict.matched} />
		</div>

		<div>
			<label for="trial" class="block text-lg font-bold">Try it on a sentence</label>
			<textarea
				id="trial"
				bind:value={text}
				rows="3"
				maxlength="3000"
				spellcheck="false"
				autocomplete="off"
				aria-describedby="trial-note"
				placeholder="Type or paste some text"
				class="mt-2 block w-full rounded-md bg-enamel p-4 text-paint-deep placeholder:text-paint/70"
			></textarea>
			<p id="trial-note" class="mt-2 text-base">
				Checked in your browser with the labeller’s own code. Nothing is sent anywhere.
			</p>
			<div class="mt-3 flex flex-wrap items-center gap-2 text-base">
				<span>Examples:</span>
				{#each examples as example (example)}
					<button
						type="button"
						class="cursor-pointer rounded-full border border-enamel/60 px-3 py-1 hover:bg-enamel hover:text-paint-deep"
						onclick={() => (text = example)}
					>
						{example}
					</button>
				{/each}
			</div>
			<div role="status" class="mt-5 min-h-24 border-t-2 border-brass pt-3">
				<p class="font-bold">{summary}</p>
				{#if reasons.length}
					<p class="mt-1">Matched: {reasons.join(' · ')}</p>
				{/if}
			</div>
		</div>
	</section>

	<section id="hidden" class="notice">
		<div class="wrap cols">
			<h2>What gets hidden</h2>
			<div>
				<p>
					It reads post text, hashtags, image and video descriptions, link cards, display names and
					bios. Common disguises, such as swapped characters or spaced-out letters, are undone
					first.
				</p>
				<dl class="mt-8">
					<div class="border-t-2 border-paint py-5">
						<dt
							class="font-(family-name:--font-sign) text-[1.45rem] leading-tight font-extrabold font-stretch-[80%]"
						>
							One distinctive term is enough
						</dt>
						<dd class="mt-2">
							The movement’s name, dehumanising names for women and men, “-cel” identities, black
							pill and appearance-ranking vocabulary, and praise for incel attacks.
						</dd>
					</div>
					<div class="border-t-2 border-paint py-5">
						<dt
							class="font-(family-name:--font-sign) text-[1.45rem] leading-tight font-extrabold font-stretch-[80%]"
						>
							Ambiguous words need company
						</dt>
						<dd class="mt-2">
							Words with everyday meanings only count when {WEAK_THRESHOLD} different kinds appear together.
						</dd>
					</div>
					<div class="border-t-2 border-paint py-5">
						<dt
							class="font-(family-name:--font-sign) text-[1.45rem] leading-tight font-extrabold font-stretch-[80%]"
						>
							Or switch on incel influenced language
						</dt>
						<dd class="mt-2">
							A second label, off by default, for posts and profiles, also covers a single ambiguous
							word, coinages on incel patterns such as “-pilled” and “-maxxing”, and many broad
							words that are usually innocent. It hides far more, and gets much more wrong.
						</dd>
					</div>
					<div class="border-y-2 border-paint py-5">
						<dt
							class="font-(family-name:--font-sign) text-[1.45rem] leading-tight font-extrabold font-stretch-[80%]"
						>
							A post label stays on that post
						</dt>
						<dd class="mt-2">
							A profile has a label of its own, which covers the profile. Neither one hides
							everything an account says. Edit the language out and the label is withdrawn.
						</dd>
					</div>
				</dl>
				<p class="mt-6">
					The full word list is public in
					<a href="{REPO_URL}/blob/main/labeller/src/detect/lexicon.ts">the source</a>. It contains
					slurs.
				</p>
			</div>
		</div>
	</section>

	<section class="wrap cols">
		<h2>Where it gets it wrong</h2>
		<ul class="grid list-disc gap-4 pl-5 marker:text-brass">
			<li>
				<strong>It matches words, not meaning.</strong> News, criticism and quotes that repeat the terms
				are hidden too.
			</li>
			<li>
				<strong>Slang has spread.</strong> Some of this vocabulary is now used as everyday internet banter,
				and that gets hidden as well.
			</li>
			<li>
				<strong>It misses things.</strong> New slang, coded phrasing and the same ideas in ordinary words
				get through.
			</li>
			<li><strong>It is mostly English,</strong> and it cannot read text inside pictures.</li>
			<li>
				<strong>It mostly looks forward.</strong> Posts made before it started, or during a long outage,
				are not labelled. Labels can arrive late when its server is busy. An older profile is checked
				only once its account posts.
			</li>
			<li>
				<strong>A label describes words,</strong> not the person who wrote them. Found a mistake?
				<a href="{REPO_URL}/issues/new/choose">Report it</a> with a made-up example, without naming anyone.
			</li>
		</ul>
	</section>

	<section id="subscribe" class="notice">
		<div class="wrap cols">
			<h2>Subscribe</h2>
			<div>
				{#if LABELLER_HANDLE}
					<p>
						Open <a href="https://bsky.app/profile/{LABELLER_HANDLE}">@{LABELLER_HANDLE}</a> on Bluesky
						and choose to subscribe. Then pick hide, warn or show for each label. The incel influenced
						language labels start off.
					</p>
				{:else}
					<p class="text-2xl font-bold">Not open yet.</p>
					<p class="mt-3">
						There is no public shut labeller to subscribe to at the moment. The code is ready to
						run, and this page will link to the account once it is live.
					</p>
				{/if}
				<h3 class="mt-10">Run your own</h3>
				<p class="mt-2">
					You need a separate Bluesky account for the labeller and a public HTTPS address.
					<a href="{REPO_URL}#go-live">Follow the setup steps</a>.
				</p>
			</div>
		</div>
	</section>
</main>
