/**
 * The distinction this whole app exists to make.
 *
 * A metric panel showing zero is ambiguous: the engine may have measured
 * nothing, or nothing may be measuring. Those demand opposite responses from an
 * operator, so every panel here carries the reason its number is what it is.
 *
 * Deciding this per panel is not decoration. Six plugins expose telemetry and
 * they fill their tables four different ways, so the answer is different for
 * two panels sitting side by side.
 */
export type SourceState =
	/** The engine records this on its own and rows came back. Trust the number. */
	| 'collecting'
	/** The engine records this on its own and the window is genuinely empty. */
	| 'idle'
	/** The table is only written by an explicit trigger nobody pulled. Zero is not a measurement. */
	| 'needs-trigger'
	/** A counter written only when a particular kind of client reports. Zero means nobody reported. */
	| 'needs-reporter'
	/** No code path in this build assigns the value. It will read zero forever. */
	| 'never'
	/** The plugin answered 402: the license does not cover it. */
	| 'unlicensed'
	/** The call failed. The panel has no number, not a zero. */
	| 'error';

export interface Provenance {
	state: SourceState;
	/** Which route produced the panel, so a reader can check it. */
	route: string;
	/** One sentence on why the panel reads the way it does. */
	detail: string;
}

/** The shapes StateMark draws. */
export type MarkShape = 'filled' | 'hollow' | 'triangle' | 'cross';

interface StateLook {
	label: string;
	/** A shape so state never rests on color alone. */
	shape: MarkShape;
	/** Whether the panel's figures mean anything. */
	trustworthy: boolean;
	className: string;
}

export const STATE_LOOK: Record<SourceState, StateLook> = {
	collecting: {
		label: 'Collecting',
		shape: 'filled',
		trustworthy: true,
		className: 'border-emerald-300 bg-emerald-50 text-emerald-900'
	},
	idle: {
		label: 'Collecting, window empty',
		shape: 'hollow',
		trustworthy: true,
		className: 'border-sky-300 bg-sky-50 text-sky-900'
	},
	'needs-trigger': {
		label: 'Not collecting: no trigger',
		shape: 'triangle',
		trustworthy: false,
		className: 'border-amber-400 bg-amber-50 text-amber-900'
	},
	'needs-reporter': {
		label: 'Not collecting: nothing reports',
		shape: 'triangle',
		trustworthy: false,
		className: 'border-amber-400 bg-amber-50 text-amber-900'
	},
	never: {
		label: 'Never populated',
		shape: 'cross',
		trustworthy: false,
		className: 'border-rose-300 bg-rose-50 text-rose-900'
	},
	unlicensed: {
		label: 'License does not cover it',
		shape: 'cross',
		trustworthy: false,
		className: 'border-rose-300 bg-rose-50 text-rose-900'
	},
	error: {
		label: 'Unreachable',
		shape: 'cross',
		trustworthy: false,
		className: 'border-rose-300 bg-rose-50 text-rose-900'
	}
};
