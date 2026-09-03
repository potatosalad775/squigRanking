<script lang="ts">
	import BadgePreview from './BadgePreview.svelte';
	import { rampColor, step, type FormState } from './form.ts';

	interface Props {
		form: FormState;
	}

	let { form = $bindable() }: Props = $props();

	function addStep(index: number) {
		const previous = form.scale[index];
		const next = form.scale[index + 1];
		const between =
			previous && next
				? (Number.parseFloat(previous.score) + Number.parseFloat(next.score)) / 2
				: Number.parseFloat(previous?.score ?? '0') - 1;
		form.scale.splice(index + 1, 0, step('', Number.isNaN(between) ? '' : String(between), ''));
		form.preset = 'custom';
	}

	function removeStep(index: number) {
		form.scale.splice(index, 1);
		form.preset = 'custom';
	}

	function move(index: number, delta: number) {
		const target = index + delta;
		if (target < 0 || target >= form.scale.length) return;
		const [item] = form.scale.splice(index, 1);
		form.scale.splice(target, 0, item!);
		form.preset = 'custom';
	}

	/**
	 * Recolor every step along a ramp. Hand-picking ten colors that read as one
	 * scale is the fiddliest part of writing a config by hand, so the editor does
	 * it in one click and lets the operator adjust from there.
	 */
	function autoColor() {
		const stops = ['#b71c1c', '#ffc107', '#4caf50', '#6c63ff'];
		const last = form.scale.length - 1;
		form.scale.forEach((entry, index) => {
			entry.color = rampColor(stops, last === 0 ? 1 : (last - index) / last);
		});
		form.preset = 'custom';
	}

	function clearColors() {
		for (const entry of form.scale) entry.color = '';
		form.preset = 'custom';
	}
</script>

<div class="scale">
	<div class="head">
		<p class="lead">
			Best first. Each step sets its own badge color and what the grade is worth, and the page
			derives the dropdown, the sort order and the chart from this one list.
		</p>
		<div class="toolbar">
			<button type="button" onclick={autoColor}>Color along a ramp</button>
			<button type="button" onclick={clearColors}>Clear colors</button>
		</div>
	</div>

	<ol class="rows">
		{#each form.scale as entry, index (entry.id)}
			<li class="row">
				<span class="preview">
					<BadgePreview
						step={entry}
						badge={form.badge}
						starsMax={form.starsMax}
						scoreMin={form.scoreMin}
						scoreMax={form.scoreMax}
						scoreDecimals={form.scoreDecimals}
					/>
				</span>

				<label class="field">
					<span>Cell value</span>
					<input
						type="text"
						bind:value={form.scale[index]!.value}
						oninput={() => (form.preset = 'custom')}
						placeholder="S"
						spellcheck="false"
					/>
				</label>

				<label class="field narrow">
					<span>Worth</span>
					<input
						type="text"
						inputmode="decimal"
						bind:value={form.scale[index]!.score}
						oninput={() => (form.preset = 'custom')}
						placeholder="5"
					/>
				</label>

				<label class="field color">
					<span>Color</span>
					<input
						type="color"
						value={entry.color || '#888888'}
						oninput={event => {
							form.scale[index]!.color = (event.currentTarget as HTMLInputElement).value;
							form.preset = 'custom';
						}}
					/>
				</label>

				<span class="actions">
					<button type="button" title="Move up" onclick={() => move(index, -1)} disabled={index === 0}
						>↑</button
					>
					<button
						type="button"
						title="Move down"
						onclick={() => move(index, 1)}
						disabled={index === form.scale.length - 1}>↓</button
					>
					<button type="button" title="Add a step below" onclick={() => addStep(index)}>+</button>
					<button
						type="button"
						title="Remove this step"
						onclick={() => removeStep(index)}
						disabled={form.scale.length <= 2}>×</button
					>
				</span>
			</li>
		{/each}
	</ol>
</div>

<style>
	.head {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: flex-start;
		justify-content: space-between;
		margin-bottom: 0.75rem;
	}
	.lead {
		margin: 0;
		max-width: 46ch;
		color: var(--sl-color-gray-2);
		font-size: 0.875rem;
	}
	.toolbar {
		display: flex;
		gap: 0.5rem;
	}
	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 0.6rem;
		padding: 0.5rem;
		border: 1px solid var(--sl-color-gray-5);
		border-radius: 0.5rem;
	}
	.preview {
		display: flex;
		align-items: center;
		min-width: 5.5rem;
		min-height: 2.25rem;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		font-size: 0.75rem;
		color: var(--sl-color-gray-2);
		flex: 1 1 7rem;
	}
	.field.narrow {
		flex: 0 1 5rem;
	}
	.field.color {
		flex: 0 0 3.5rem;
	}
	.field input[type='text'] {
		width: 100%;
		padding: 0.3rem 0.45rem;
		border: 1px solid var(--sl-color-gray-5);
		border-radius: 0.35rem;
		background: var(--sl-color-black);
		color: var(--sl-color-white);
		font: inherit;
		font-size: 0.875rem;
	}
	.field input[type='color'] {
		width: 100%;
		height: 2rem;
		padding: 0;
		border: 1px solid var(--sl-color-gray-5);
		border-radius: 0.35rem;
		background: none;
	}
	.actions {
		display: flex;
		gap: 0.2rem;
	}
	button {
		padding: 0.3rem 0.55rem;
		border: 1px solid var(--sl-color-gray-5);
		border-radius: 0.35rem;
		background: var(--sl-color-black);
		color: var(--sl-color-white);
		font: inherit;
		font-size: 0.8rem;
		cursor: pointer;
	}
	button:hover:not(:disabled) {
		background: var(--sl-color-gray-6);
	}
	button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
</style>
