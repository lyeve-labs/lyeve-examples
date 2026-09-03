const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** Prices are held in whole cents, so the division is the only rounding there is. */
export function formatPrice(cents: number): string {
	return money.format(cents / 100);
}

export function formatRating(rating: number): string {
	return rating.toFixed(1);
}
