import { useRef } from 'react';

interface SpanishKeyboardProps {
  onKeyPress: (key: string) => void;
  onBackspace: () => void;
  onEnter: () => void;
}

export function SpanishKeyboard({ onKeyPress, onBackspace, onEnter }: SpanishKeyboardProps) {
  const specialChars = ['á', 'é', 'í', 'ó', 'ú',  '¡', '!','¿', '?'];
  const activeTouchesRef = useRef<Set<number>>(new Set());
  const touchUsedRef = useRef(false);

  const handleKeyAction = (e: React.TouchEvent, action: () => void) => {
    e.preventDefault();
    e.stopPropagation();
    touchUsedRef.current = true;
    
    // Handle touch events (mobile) with multi-touch support
    const touches = Array.from(e.touches);
    const newTouch = touches[touches.length - 1];
    
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
    // Remove ended touches from tracking
    const remainingTouches = new Set(Array.from(e.touches).map(t => t.identifier));
    activeTouchesRef.current = remainingTouches;
  };

  return (
    <div 
      className="bg-gray-100 dark:bg-gray-700 p-1 space-y-2 select-none"
      onTouchEnd={handleTouchEnd}
    >
      {/* Special characters row */}
      <div className="flex justify-center gap-1 sm:gap-2">
        {specialChars.map((char) => (
          <button
            key={char}
            data-key={char}
            onMouseDown={(e) => handleMouseAction(e, () => onKeyPress(char))}
            onTouchStart={(e) => handleKeyAction(e, () => onKeyPress(char))}
            className="flex-1 max-w-[40px] sm:max-w-[50px] h-12 bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-700 rounded-lg font-semibold text-white transition-colors active:scale-95 shadow-sm"
          >
            {char}
          </button>
        ))}
      </div>

      {/* First row */}
      <div className="flex justify-center gap-1 sm:gap-2">
        {['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'].map((key) => (
          <button
            key={key}
            data-key={key}
            onMouseDown={(e) => handleMouseAction(e, () => onKeyPress(key))}
            onTouchStart={(e) => handleKeyAction(e, () => onKeyPress(key))}
            className="flex-1 max-w-[40px] sm:max-w-[50px] h-12 bg-white dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-lg font-semibold text-gray-900 dark:text-white transition-colors active:scale-95 shadow-sm"
          >
            {key}
          </button>
        ))}
      </div>

      {/* Second row */}
      <div className="flex justify-center gap-1 sm:gap-2">
        {['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ñ'].map((key) => (
          <button
            key={key}
            data-key={key}
            onMouseDown={(e) => handleMouseAction(e, () => onKeyPress(key))}
            onTouchStart={(e) => handleKeyAction(e, () => onKeyPress(key))}
            className="flex-1 max-w-[40px] sm:max-w-[50px] h-12 bg-white dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-lg font-semibold text-gray-900 dark:text-white transition-colors active:scale-95 shadow-sm"
          >
            {key}
          </button>
        ))}
      </div>

      {/* Third row with backspace */}
      <div className="flex justify-center gap-1 sm:gap-2">
        {['z', 'x', 'c', 'v', 'b', 'n', 'm'].map((key) => (
          <button
            key={key}
            data-key={key}
            onMouseDown={(e) => handleMouseAction(e, () => onKeyPress(key))}
            onTouchStart={(e) => handleKeyAction(e, () => onKeyPress(key))}
            className="flex-1 max-w-[40px] sm:max-w-[50px] h-12 bg-white dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-lg font-semibold text-gray-900 dark:text-white transition-colors active:scale-95 shadow-sm"
          >
            {key}
          </button>
        ))}
        <button
          data-key="backspace"
          onMouseDown={(e) => handleMouseAction(e, onBackspace)}
          onTouchStart={(e) => handleKeyAction(e, onBackspace)}
          className="flex-1 max-w-[60px] h-12 bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 rounded-lg font-semibold text-white transition-colors active:scale-95 shadow-sm"
        >
          ⌫
        </button>
      </div>

      {/* Space and enter row */}
      <div className="flex justify-center gap-1 sm:gap-2">
        <button
          data-key=" "
          onMouseDown={(e) => handleMouseAction(e, () => onKeyPress(' '))}
          onTouchStart={(e) => handleKeyAction(e, () => onKeyPress(' '))}
          className="flex-[4] h-12 bg-white dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-lg font-semibold text-gray-900 dark:text-white transition-colors active:scale-95 shadow-sm"
        >
          espacio
        </button>
        <button
          data-key="enter"
          onMouseDown={(e) => handleMouseAction(e, onEnter)}
          onTouchStart={(e) => handleKeyAction(e, onEnter)}
          className="flex-1 max-w-[80px] h-12 bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 rounded-lg font-semibold text-white transition-colors active:scale-95 shadow-sm"
        >
          ↵
        </button>
      </div>
    </div>
  );
}
