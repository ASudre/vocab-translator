import { memo, useRef } from 'react';
import type { SVGProps } from 'react';
import { useTranslations } from 'next-intl';
import { Key } from './Key';

// Inline SVGs, same rationale as BottomNav's icons: a handful of glyphs
// don't justify an icon library dependency or an extra offline-cache chunk.
function BackspaceIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M22 3H7c-.69 0-1.23.35-1.59.88L0 12l5.41 8.11c.36.53.9.89 1.59.89h15c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2.59 12.59L18 17l-3-3-3 3-1.41-1.41L13.17 12 10.17 9l1.41-1.41 3 3 3-3L19 9l-3 3 3 3z" />
    </svg>
  );
}

function EnterIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M19 7v4H5.83l3.58-3.59L8 6l-6 6 6 6 1.41-1.41L5.83 13H21V7z" />
    </svg>
  );
}

function NextIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M4 11v2h12l-5.5 5.5 1.42 1.42L19.84 12l-7.92-7.92L10.5 5.5 16 11H4z" />
    </svg>
  );
}

interface SpanishKeyboardProps {
  onKeyPress: (key: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  onEnter: () => void;
  onToggleSolution: () => void;
  onNext: () => void;
  showSolution: boolean;
}

export const SpanishKeyboard = memo(function SpanishKeyboard({ onKeyPress, onBackspace, onClear, onEnter, onToggleSolution, onNext, showSolution }: SpanishKeyboardProps) {
  const t = useTranslations('SpanishKeyboard');
  const specialChars = ['á', 'é', 'í', 'ó', 'ú', 'ü', '¡', '!', '¿', '?'];
  const activeTouchesRef = useRef<Set<number>>(new Set());
  const touchUsedRef = useRef(false);

  const handleKeyAction = (e: React.TouchEvent, action: () => void) => {
    e.preventDefault();
    e.stopPropagation();
    touchUsedRef.current = true;

    // Use changedTouches (the touch that triggered this event) instead of touches
    // (all active touches globally) to avoid ambiguity/races with reused touch identifiers
    const newTouch = e.changedTouches[0];

    // Only trigger if this touch hasn't been registered yet
    if (!activeTouchesRef.current.has(newTouch.identifier)) {
      activeTouchesRef.current.add(newTouch.identifier);
      action();
    }
  };

  const handleMouseAction = (e: React.MouseEvent, action: () => void) => {
    // If touch was used, ignore mouse events (they're compatibility events on mobile)
    if (touchUsedRef.current) {
      e.preventDefault();
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    action();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const remainingTouches = new Set(Array.from(e.touches).map(t => t.identifier));
    activeTouchesRef.current = remainingTouches;
  };

  return (
    <div
      className="bg-gray-100 dark:bg-gray-900 select-none p-1"
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* Special characters row */}
      <div className="flex justify-center">
        {specialChars.map((char) => (
          <Key
            key={char}
            value={char}
            onPress={() => onKeyPress(char)}
            onMouseAction={handleMouseAction}
            onTouchAction={handleKeyAction}
            variant="special"
          />
        ))}
      </div>

      {/* First row */}
      <div className="flex justify-center">
        {['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'].map((key) => (
          <Key
            key={key}
            value={key}
            onPress={() => onKeyPress(key)}
            onMouseAction={handleMouseAction}
            onTouchAction={handleKeyAction}
          />
        ))}
      </div>

      {/* Second row */}
      <div className="flex justify-center">
        {['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ñ'].map((key) => (
          <Key
            key={key}
            value={key}
            onPress={() => onKeyPress(key)}
            onMouseAction={handleMouseAction}
            onTouchAction={handleKeyAction}
          />
        ))}
      </div>

      {/* Third row: an invisible spacer on the left matches the backspace
          div's width on the right (both w-[15%], vs. w-[10%] for a
          letter) — the two must sum to exactly 100% with the 7 letters
          (15+70+15) so the row has no leftover/negative space, which is
          what centers the letters and keeps them the same width as the
          rows above. Backspace lives in its own div (rather than sizing
          the Key directly) so its inner padding/margin can be tuned
          without touching that 15/70/15 balance. Holding backspace
          (instead of a separate button) clears the whole answer, so
          there's no destructive key sitting right above the solution
          bulb where a mistap could wipe it. */}
      <div className="flex">
        <div aria-hidden="true" className="flex-none w-[15%]" />
        {['z', 'x', 'c', 'v', 'b', 'n', 'm'].map((key) => (
          <Key
            key={key}
            value={key}
            onPress={() => onKeyPress(key)}
            onMouseAction={handleMouseAction}
            onTouchAction={handleKeyAction}
            flex="flex-none w-[10%]"
          />
        ))}
        <div className="flex-none w-[15%] flex pl-2">
          <Key
            value={<BackspaceIcon className="h-6 w-6" />}
            ariaLabel={t('backspace')}
            onPress={onBackspace}
            onLongPress={onClear}
            onMouseAction={handleMouseAction}
            onTouchAction={handleKeyAction}
            variant="danger"
            disabled={showSolution}
            flex="flex-1"
            maxWidth=""
          />
        </div>
      </div>

      {/* Space and enter row */}
      <div className="flex justify-center">
        <Key
          value={showSolution ? <NextIcon className="h-5 w-5" /> : '💡'}
          ariaLabel={showSolution ? t('next') : t('hint')}
          onPress={showSolution ? onNext : onToggleSolution}
          onMouseAction={handleMouseAction}
          onTouchAction={handleKeyAction}
          variant="special"
          maxWidth="max-w-[60px]"
          className="text-xl"
        />
        <Key
          value={t('space')}
          onPress={() => onKeyPress(' ')}
          onMouseAction={handleMouseAction}
          onTouchAction={handleKeyAction}
          flex="flex-[4]"
          maxWidth=""
        />
        <Key
          value={<EnterIcon className="h-6 w-6" />}
          ariaLabel={t('enter')}
          onPress={onEnter}
          onMouseAction={handleMouseAction}
          onTouchAction={handleKeyAction}
          variant="success"
          disabled={showSolution}
          maxWidth="max-w-[80px]"
        />
      </div>
    </div>
  );
});
