<script lang="ts">
	import { readableTextColor, type BadgeKind, type ScaleStep } from './form.ts';

	interface Props {
		step: ScaleStep;
		badge: BadgeKind;
		starsMax: number;
		scoreMin: number;
		scoreMax: number;
		scoreDecimals: number;
	}

	let { step, badge, starsMax, scoreMin, scoreMax, scoreDecimals }: Props = $props();

	let numeric = $derived(Number.parseFloat(step.value));
	let fillRatio = $derived(
		Number.isNaN(numeric) ? 0 : Math.min(1, Math.max(0, numeric / Math.max(1, starsMax))),
	);
	let scoreText = $derived(Number.isNaN(numeric) ? step.value : numeric.toFixed(scoreDecimals));
	let background = $derived(step.color.trim());
	let foreground = $derived(background ? readableTextColor(background) : '');
	let scorePosition = $derived(
		scoreMax === scoreMin ? 1 : (numeric - scoreMin) / (scoreMax - scoreMin),
	);
</script>

{#if badge === 'stars'}
	<span class="stars" role="img" aria-label={`${step.value} out of ${starsMax}`}>
		<span class="track" aria-hidden="true">
			{#each { length: starsMax } as _, i (i)}
				<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
					<path
						d="M12 18.26L4.94729 22.2082L6.52281 14.2799L0.587921 8.7918L8.61494 7.84006L12 0.5L15.3851 7.84006L23.4121 8.7918L17.4772 14.2799L19.0527 22.2082L12 18.26Z"
					/>
				</svg>
			{/each}
		</span>
		<span class="fill" aria-hidden="true" style:width={`${fillRatio * 100}%`}>
			{#each { length: starsMax } as _, i (i)}
				<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
					<path
						d="M12 18.26L4.94729 22.2082L6.52281 14.2799L0.587921 8.7918L8.61494 7.84006L12 0.5L15.3851 7.84006L23.4121 8.7918L17.4772 14.2799L19.0527 22.2082L12 18.26Z"
					/>
				</svg>
			{/each}
		</span>
	</span>
{:else if badge === 'score-badge'}
	<span
		class="badge pill"
		style:background={background || undefined}
		style:color={foreground || undefined}
		title={`Position on the ramp: ${(scorePosition * 100).toFixed(0)}%`}
	>
		{scoreText}
	</span>
{:else}
	<span
		class="badge"
		style:background={background || undefined}
		style:color={foreground || undefined}
	>
		{step.value || '?'}
	</span>
{/if}

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 2.25rem;
		height: 2.25rem;
		padding: 0 0.4rem;
		border-radius: 1rem;
		font-weight: 700;
		font-size: 0.9rem;
		background: var(--sl-color-gray-5);
		color: var(--sl-color-white);
		font-variant-numeric: tabular-nums;
	}
	.pill {
		min-width: 2.75rem;
	}
	.stars {
		position: relative;
		display: inline-block;
		line-height: 0;
		white-space: nowrap;
	}
	.track,
	.fill {
		display: block;
		line-height: 0;
		white-space: nowrap;
	}
	.track {
		color: var(--sl-color-gray-5);
	}
	.fill {
		position: absolute;
		top: 0;
		left: 0;
		overflow: hidden;
		color: #ffb400;
	}
</style>
