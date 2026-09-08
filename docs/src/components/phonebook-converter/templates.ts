// The header row of each preset's `TEMPLATE.csv`.
//
// Repeated here rather than imported: the docs site builds as its own package,
// and four lines of headers are cheaper to keep in step than a cross-package
// build dependency. `test/phonebook-converter.test.ts` reads the real files and
// fails if either side drifts, the same way the editor's color math is guarded.
//
// This is what makes the converter's output paste-compatible with the workbook
// an operator downloaded: same columns, same order.

export const TEMPLATE_HEADERS: Record<string, string[]> = {
	letter: [
		'Brand', 'Model', 'Rank', 'Score', 'Type', 'Tags',
		'Comment', 'Pros', 'Cons', 'Notes',
		'Comment_KR', 'Pros_KR', 'Cons_KR', 'Notes_KR',
	],
	stars: [
		'Brand', 'Model', 'Rank', 'Type', 'Tags',
		'Comment', 'Pros', 'Cons', 'Notes',
		'Comment_KR', 'Pros_KR', 'Cons_KR', 'Notes_KR',
	],
	score: [
		'Brand', 'Model', 'Rank', 'Type', 'Tags',
		'Comment', 'Pros', 'Cons', 'Notes',
		'Comment_KR', 'Pros_KR', 'Cons_KR', 'Notes_KR',
	],
};

/** Template columns a phone book `description` can reasonably be dropped into. */
export const DESCRIPTION_TARGETS = ['Comment', 'Notes'] as const;
