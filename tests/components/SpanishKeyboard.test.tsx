import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithIntl } from '../helpers/renderWithIntl';
import { touchStart, touchEnd } from '../helpers/touch';
import { SpanishKeyboard } from '@/app/[locale]/components/SpanishKeyboard';

const setup = () => {
  const onKeyPress = vi.fn();
  const onBackspace = vi.fn();
  const onClear = vi.fn();
  const onEnter = vi.fn();
  const onToggleSolution = vi.fn();
  const onNext = vi.fn();

  renderWithIntl(
    <SpanishKeyboard
      onKeyPress={onKeyPress}
      onBackspace={onBackspace}
      onClear={onClear}
      onEnter={onEnter}
      onToggleSolution={onToggleSolution}
      onNext={onNext}
      showSolution={false}
    />
  );

  // Key's clickable surface (and the data-key attribute) is the <button>;
  // its label text lives in a child <span>, so resolve up to the button.
  const key = (label: string) => screen.getByText(label).closest('button')!;

  return { onKeyPress, onBackspace, onClear, onEnter, onToggleSolution, onNext, key };
};

describe('SpanishKeyboard', () => {
  it('renders every accented/special character required to type Spanish answers', () => {
    setup();
    for (const char of ['á', 'é', 'í', 'ó', 'ú', 'ü', '¡', '¿', 'ñ']) {
      expect(screen.getByText(char)).toBeInTheDocument();
    }
  });

  it('fires onKeyPress on a plain touch tap', () => {
    const { onKeyPress, key } = setup();

    touchStart(key('a'), 0);
    expect(onKeyPress).toHaveBeenCalledTimes(1);
    expect(onKeyPress).toHaveBeenCalledWith('a');
  });

  it('deduplicates a repeated touchstart for the same identifier without an intervening touchend', () => {
    // This is the "missing key on quick typing" bug scenario: the browser
    // reuses a touch identifier before its touchend has been observed.
    const { onKeyPress, key } = setup();

    touchStart(key('a'), 0);
    touchStart(key('a'), 0); // same identifier, still "active" per the component's bookkeeping
    expect(onKeyPress).toHaveBeenCalledTimes(1);
  });

  it('accepts a new tap once the identifier is released via touchend on the keyboard container', () => {
    const { onKeyPress, key } = setup();
    // The touchend/touchcancel listeners live on the outer keyboard wrapper,
    // two levels above a key's <button> (button -> row -> wrapper).
    const container = key('a').parentElement!.parentElement!;

    touchStart(key('a'), 0);
    touchEnd(container, 0, []); // identifier 0 released, no touches remain
    touchStart(key('a'), 0); // identifier reused for a fresh tap

    expect(onKeyPress).toHaveBeenCalledTimes(2);
  });

  it('handles two fingers typing different keys concurrently', () => {
    const { onKeyPress, key } = setup();

    touchStart(key('a'), 0);
    touchStart(key('s'), 1, [0, 1]);

    expect(onKeyPress).toHaveBeenCalledTimes(2);
    expect(onKeyPress).toHaveBeenNthCalledWith(1, 'a');
    expect(onKeyPress).toHaveBeenNthCalledWith(2, 's');
  });

  it('suppresses the synthetic mousedown that follows a touch tap', () => {
    const { onKeyPress, key } = setup();

    touchStart(key('a'), 0);
    fireEvent.mouseDown(key('a')); // browsers fire a compatibility mousedown after touch
    expect(onKeyPress).toHaveBeenCalledTimes(1);
  });

  it('fires onKeyPress on mousedown when no touch has occurred', () => {
    const { onKeyPress, key } = setup();

    fireEvent.mouseDown(key('a'));
    expect(onKeyPress).toHaveBeenCalledTimes(1);
    expect(onKeyPress).toHaveBeenCalledWith('a');
  });

  it('space and enter keys invoke their respective handlers', () => {
    const { onKeyPress, onEnter, key } = setup();

    fireEvent.mouseDown(key('espacio'));
    expect(onKeyPress).toHaveBeenCalledWith(' ');

    fireEvent.mouseDown(key('↵'));
    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it('fires onBackspace on a quick tap of the backspace key', () => {
    const { onBackspace, onClear, key } = setup();

    fireEvent.mouseDown(key('←'));
    fireEvent.mouseUp(key('←'));

    expect(onBackspace).toHaveBeenCalledTimes(1);
    expect(onClear).not.toHaveBeenCalled();
  });

  it('fires onClear (not onBackspace) on a long press of the backspace key', () => {
    vi.useFakeTimers();
    const { onBackspace, onClear, key } = setup();

    fireEvent.mouseDown(key('←'));
    vi.advanceTimersByTime(500);
    fireEvent.mouseUp(key('←'));

    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onBackspace).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('does not fire onBackspace or onClear if the press is released without a mouseup (e.g. dragged off)', () => {
    vi.useFakeTimers();
    const { onBackspace, onClear, key } = setup();

    fireEvent.mouseDown(key('←'));
    fireEvent.mouseLeave(key('←'));
    vi.advanceTimersByTime(500);

    expect(onBackspace).not.toHaveBeenCalled();
    expect(onClear).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
