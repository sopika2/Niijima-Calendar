/** A Svelte action: a sideways swipe calls `left` or `right` (next / previous on a phone). */
export function swipe(node: HTMLElement, handlers: { left: () => void; right: () => void }) {
	let current = handlers;
	let start: { x: number; y: number; at: number } | null = null;

	const down = (event: PointerEvent) => {
		if (event.pointerType === 'mouse') return;
		start = { x: event.clientX, y: event.clientY, at: Date.now() };
	};
	const up = (event: PointerEvent) => {
		if (!start) return;
		const dx = event.clientX - start.x;
		const dy = event.clientY - start.y;
		const quick = Date.now() - start.at < 700;
		start = null;
		if (quick && Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.8) {
			if (dx < 0) current.left();
			else current.right();
		}
	};
	const cancel = () => (start = null);

	node.addEventListener('pointerdown', down);
	node.addEventListener('pointerup', up);
	node.addEventListener('pointercancel', cancel);
	return {
		update(next: typeof handlers) {
			current = next;
		},
		destroy() {
			node.removeEventListener('pointerdown', down);
			node.removeEventListener('pointerup', up);
			node.removeEventListener('pointercancel', cancel);
		}
	};
}
