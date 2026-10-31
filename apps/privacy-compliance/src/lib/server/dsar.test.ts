import { beforeEach, describe, expect, it, vi } from 'vitest';

const request = vi.fn();
vi.mock('./lyeve', () => ({ lyeve: { request } }));

const { runErase } = await import('./dsar');

describe('runErase', () => {
	beforeEach(() => request.mockReset());

	it('reads a 200 as a completed erasure', async () => {
		request.mockResolvedValue({
			identifier: 'marta@example.com',
			total_rows: 7,
			complete: true,
			errors: null
		});
		const result = await runErase('marta@example.com');
		expect(result.state).toBe('erased');
		expect(result.state === 'erased' && result.rows).toBe(7);
	});

	it('reads a 207 as an incomplete erasure with its failed parts', async () => {
		request.mockResolvedValue({
			identifier: 'marta@example.com',
			total_rows: 4,
			complete: false,
			failed: ['analytics', 'account'],
			errors: [
				'not finished: analytics, account',
				'the account was not erased: it is signed out and locked until every other part has erased',
				'repeat the request to finish the erasure'
			]
		});
		const result = await runErase('marta@example.com');
		expect(result.state).toBe('partial');
		expect(result.state === 'partial' && result.failed).toEqual(['analytics', 'account']);
		expect(result.state === 'partial' && result.rows).toBe(4);
	});

	it('reads a 207 that names no failed part as incomplete', async () => {
		request.mockResolvedValue({
			identifier: 'marta@example.com',
			total_rows: 4,
			complete: false,
			errors: [
				"not finished: some rows were kept because they cannot be told apart from another account's data"
			]
		});
		const result = await runErase('marta@example.com');
		expect(result.state).toBe('partial');
		expect(result.state === 'partial' && result.failed).toEqual([]);
	});

	it('reads an older engine by its errors', async () => {
		request.mockResolvedValue({ identifier: 'marta@example.com', total_rows: 3, errors: null });
		expect((await runErase('marta@example.com')).state).toBe('erased');

		request.mockResolvedValue({
			identifier: 'marta@example.com',
			total_rows: 3,
			errors: ['one or more erasers failed']
		});
		const result = await runErase('marta@example.com');
		expect(result.state).toBe('partial');
		expect(result.state === 'partial' && result.failed).toEqual([]);
	});
});
