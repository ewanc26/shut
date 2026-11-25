<script lang="ts">
	let { shut }: { shut: boolean } = $props();
</script>

<!-- Decorative: the verdict is announced in text next to it. -->
<div class="hanger" aria-hidden="true">
	<svg class="cord" viewBox="0 0 200 70" preserveAspectRatio="none">
		<path d="M20 70 L100 8 L180 70" />
		<circle cx="100" cy="8" r="6" />
	</svg>
	<div class="flip" class:shut>
		<div class="face open">
			<span class="small">Come in, we’re</span>
			<span class="word">Open</span>
		</div>
		<div class="face closed">
			<span class="small">Sorry, we’re</span>
			<span class="word">Shut</span>
		</div>
	</div>
</div>

<style>
	.hanger {
		width: min(100%, 25rem);
		margin-inline: auto;
		perspective: 70rem;
	}
	.cord {
		display: block;
		width: 100%;
		height: 3.5rem;
		fill: var(--color-brass);
		stroke: var(--color-brass);
		stroke-width: 2;
	}
	.cord path {
		fill: none;
		vector-effect: non-scaling-stroke;
	}
	.flip {
		display: grid;
		aspect-ratio: 5 / 3;
		transform-style: preserve-3d;
		transition: transform 500ms cubic-bezier(0.3, 0.7, 0.2, 1);
		container-type: inline-size;
	}
	.flip.shut {
		transform: rotateY(180deg);
	}
	.face {
		grid-area: 1 / 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		border-radius: 1rem;
		border: 0.45rem solid currentColor;
		outline: 0.5rem solid var(--plate);
		background: var(--plate);
		backface-visibility: hidden;
		text-transform: uppercase;
	}
	.open {
		--plate: var(--color-enamel);
		color: var(--color-paint);
	}
	.closed {
		--plate: var(--color-signal);
		color: var(--color-enamel);
		transform: rotateY(180deg);
	}
	.small {
		font-family: var(--font-body);
		font-weight: 700;
		font-size: 6cqi;
		letter-spacing: 0.18em;
	}
	.word {
		font-family: var(--font-sign);
		font-stretch: 75%;
		font-weight: 800;
		font-size: 34cqi;
		line-height: 0.95;
	}
	@media (prefers-reduced-motion: reduce) {
		.flip {
			transition: none;
		}
	}
	@media (forced-colors: active) {
		.closed {
			visibility: hidden;
		}
		.flip.shut {
			transform: none;
		}
		.flip.shut .open {
			visibility: hidden;
		}
		.flip.shut .closed {
			visibility: visible;
			transform: none;
		}
	}
</style>
