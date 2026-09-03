/** Renders a run time the way a course listing does, not as a raw minute count. */
export function formatMinutes(total: number): string {
	if (total < 60) return `${total} min`;
	const hours = Math.floor(total / 60);
	const minutes = total % 60;
	return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`;
}
