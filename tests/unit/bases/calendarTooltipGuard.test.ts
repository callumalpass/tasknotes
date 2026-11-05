import { installCalendarTooltipGuard } from '../../../src/bases/calendarTooltipGuard';

describe('calendar gesture tooltip guard', () => {
  afterEach(() => {
    document.body.replaceChildren();
    document.body.classList.remove('tn-calendar-gesture');
  });

  it('dismisses an open tooltip and suppresses new tooltips until the gesture ends', async () => {
    const root = document.createElement('div');
    const calendar = root.appendChild(document.createElement('div'));
    document.body.append(root);
    const dispose = installCalendarTooltipGuard(root);
    const tooltip = document.body.appendChild(document.createElement('div'));
    tooltip.className = 'tooltip';
    calendar.classList.add('tnc-dragging');
    await Promise.resolve();
    expect(tooltip.isConnected).toBe(false);
    expect(document.body.classList.contains('tn-calendar-gesture')).toBe(true);
    const dateTooltip = document.body.appendChild(document.createElement('div'));
    dateTooltip.className = 'tooltip';
    calendar.classList.remove('tnc-dragging');
    await Promise.resolve();
    expect(dateTooltip.isConnected).toBe(false);
    expect(document.body.classList.contains('tn-calendar-gesture')).toBe(false);
    dispose();
  });

  it('retains suppression for another active calendar and cleans up on unload', async () => {
    const roots = [document.createElement('div'), document.createElement('div')];
    document.body.append(...roots);
    const disposers = roots.map(installCalendarTooltipGuard);
    roots.forEach(root => root.classList.add('tnc-dragging'));
    await Promise.resolve();
    disposers[0]();
    expect(document.body.classList.contains('tn-calendar-gesture')).toBe(true);
    disposers[1]();
    expect(document.body.classList.contains('tn-calendar-gesture')).toBe(false);
  });
});
