import { installCalendarTooltipGuard } from '../../../src/bases/calendarTooltipGuard';

describe('calendar gesture tooltip guard', () => {
  it('reserves toast space while any observed calendar has a selection and releases it on disposal', async () => {
    const first = document.body.appendChild(document.createElement('div'));
    const second = document.body.appendChild(document.createElement('div'));
    const disposeFirst = installCalendarTooltipGuard(first);
    const disposeSecond = installCalendarTooltipGuard(second);
    first.classList.add('tn-calendar-has-selection');
    second.classList.add('tn-calendar-has-selection');
    await Promise.resolve();
    expect(document.body.classList.contains('tn-calendar-has-selection')).toBe(true);
    disposeFirst();
    expect(document.body.classList.contains('tn-calendar-has-selection')).toBe(true);
    disposeSecond();
    expect(document.body.classList.contains('tn-calendar-has-selection')).toBe(false);
  });
  afterEach(() => {
    document.body.replaceChildren();
    document.body.classList.remove('tn-calendar-gesture', 'tn-calendar-has-selection');
  });

  it('suppresses tooltips through the drop until the pointer moves or keyboard resumes', async () => {
    const root = document.createElement('div');
    const calendar = root.appendChild(document.createElement('div'));
    document.body.append(root);
    const dispose = installCalendarTooltipGuard(root);
    const occurrence = calendar.appendChild(document.createElement('div'));
    occurrence.className = 'fc-task-event--related-hover';
    const tooltip = document.body.appendChild(document.createElement('div'));
    tooltip.className = 'tooltip';
    calendar.classList.add('tnc-dragging');
    await Promise.resolve();
    expect(tooltip.isConnected).toBe(false);
    expect(document.body.classList.contains('tn-calendar-gesture')).toBe(true);
    expect(occurrence.className).toBe('');
    const dateTooltip = document.body.appendChild(document.createElement('div'));
    dateTooltip.className = 'tooltip';
    occurrence.className = 'fc-task-event--hover-source';
    calendar.classList.remove('tnc-dragging');
    await Promise.resolve();
    expect(dateTooltip.isConnected).toBe(false);
    expect(document.body.classList.contains('tn-calendar-gesture')).toBe(true);
    expect(occurrence.className).toBe('');
    document.dispatchEvent(new MouseEvent('pointermove', { clientX: 1, clientY: 1 }));
    expect(document.body.classList.contains('tn-calendar-gesture')).toBe(true);
    document.dispatchEvent(new MouseEvent('pointermove', { clientX: 8, clientY: 1 }));
    expect(document.body.classList.contains('tn-calendar-gesture')).toBe(false);
    calendar.classList.add('tnc-dragging');
    await Promise.resolve();
    calendar.classList.remove('tnc-dragging');
    await Promise.resolve();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
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
