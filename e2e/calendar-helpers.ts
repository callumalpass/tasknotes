import type { Page } from '@playwright/test';

type Box = { x: number; y: number; width: number; height: number };

/**
 * Time slots of the first time-grid column. @tasknotes/calendar draws slot
 * lines as a background, so slots are computed from the column geometry and
 * the grid's `--tnc-slot-px` instead of being located as elements.
 */
export function calendarTimeSlots(page: Page) {
  const geometry = () =>
    page.evaluate(() => {
      const grid = document.querySelector<HTMLElement>('.tnc-tg');
      const col = grid?.querySelector<HTMLElement>('.tnc-col');
      if (!grid || !col) return null;
      const slotPx = parseFloat(getComputedStyle(grid).getPropertyValue('--tnc-slot-px')) || 0;
      const r = col.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, slotPx };
    });
  const slot = (index: () => Promise<number>) => ({
    async boundingBox(): Promise<Box | null> {
      const g = await geometry();
      if (!g || !g.slotPx) return null;
      const i = await index();
      return { x: g.x, y: g.y + i * g.slotPx, width: g.width, height: g.slotPx };
    },
  });
  const count = async () => {
    const g = await geometry();
    return g && g.slotPx ? Math.round(g.height / g.slotPx) : 0;
  };
  return {
    count,
    nth: (i: number) => slot(async () => i),
    first: () => slot(async () => 0),
    last: () => slot(async () => Math.max(0, (await count()) - 1)),
  };
}
