import React, { memo, useRef } from 'react';

interface KeyProps {
  value: React.ReactNode;
  // Accessible name and data-key identifier. Defaults to `value` when it's a
  // plain string (a letter key); required for keys whose value is an icon.
  ariaLabel?: string;
  onPress: () => void;
  onMouseAction: (e: React.MouseEvent, action: () => void) => void;
  onTouchAction: (e: React.TouchEvent, action: () => void) => void;
  // When set, a quick tap still fires onPress as usual, but holding the key
  // for longPressMs instead fires onLongPress (and suppresses onPress).
  onLongPress?: () => void;
  longPressMs?: number;
  variant?: 'default' | 'special' | 'action' | 'danger' | 'success';
  disabled?: boolean;
  className?: string;
  maxWidth?: string;
  flex?: string;
}

export const Key = memo(function Key({
  value,
  ariaLabel,
  onPress,
  onMouseAction,
  onTouchAction,
  onLongPress,
  longPressMs = 500,
  variant = 'default',
  disabled = false,
  className = '',
  maxWidth = '',
  flex = 'flex-1'
}: KeyProps) {
  const label = ariaLabel ?? (typeof value === 'string' ? value : undefined);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Passed as the "action" to onMouseAction/onTouchAction. Without
  // onLongPress this fires onPress immediately, same as before. With it,
  // pressing down only arms a timer — onPress fires on release instead, so
  // it can be suppressed if the hold turns into a long press.
  const startPress = () => {
    if (!onLongPress) {
      onPress();
      return;
    }
    longPressFiredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      longPressTimerRef.current = null;
      onLongPress();
    }, longPressMs);
  };

  const endPress = () => {
    if (!onLongPress) return;
    clearLongPressTimer();
    if (!longPressFiredRef.current) {
      onPress();
    }
    longPressFiredRef.current = false;
  };
  // Padding on the button (not the inner span) creates the visible gap between keys.
  const buttonClasses = `${flex} ${maxWidth} h-12 sm:h-14 px-[3px] py-[4px] touch-manipulation [-webkit-tap-highlight-color:transparent]`;

  // Inner span has the visual styling with rounded corners.
  // Pressing snaps instantly (duration-0) so the key visibly "lights up" the moment it registers;
  // releasing eases back over 150ms so it doesn't feel abrupt.
  const innerBaseClasses = 'w-full h-full flex items-center justify-center rounded-md font-normal text-xl shadow-[0_2px_0_rgba(0,0,0,0.3)] transition-[transform,background-color] duration-150 active:duration-0 active:scale-90 active:shadow-none';

  const variantClasses = {
    default: 'bg-white dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 active:bg-gray-300 dark:active:bg-gray-400 text-gray-900 dark:text-white',
    special: 'bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-700 active:bg-amber-700 dark:active:bg-amber-800 text-white',
    action: 'bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 active:bg-blue-700 dark:active:bg-blue-800 text-white',
    danger: 'bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 active:bg-red-700 dark:active:bg-red-800 text-white',
    success: 'bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 active:bg-green-700 dark:active:bg-green-800 text-white'
  };

  const disabledClasses = disabled
    ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed opacity-50'
    : variantClasses[variant];

  return (
    <button
      data-key={label}
      aria-label={label}
      onMouseDown={(e) => !disabled && onMouseAction(e, startPress)}
      onTouchStart={(e) => !disabled && onTouchAction(e, startPress)}
      // Routed through onMouseAction (not called directly) so it's gated by
      // the same touchUsedRef check as onMouseDown — otherwise the ghost
      // mouseup browsers fire after a real touchend would call endPress()
      // a second time and double-fire onPress.
      onMouseUp={(e) => !disabled && onMouseAction(e, endPress)}
      onMouseLeave={() => !disabled && clearLongPressTimer()}
      onTouchEnd={() => !disabled && endPress()}
      onTouchCancel={() => !disabled && clearLongPressTimer()}
      disabled={disabled}
      className={buttonClasses}
    >
      <span className={`${innerBaseClasses} ${disabledClasses} ${className}`}>
        {value}
      </span>
    </button>
  );
});
