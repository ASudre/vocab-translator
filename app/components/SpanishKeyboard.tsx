import { useRef } from 'react';
import { Key } from './Key';

interface SpanishKeyboardProps {
  onKeyPress: (key: string) => void;
  onBackspace: () => void;
  onEnter: () => void;
  onToggleSolution: () => void;
  onNext: () => void;
  showSolution: boolean;
}

export function SpanishKeyboard({ onKeyPress, onBackspace, onEnter, onToggleSolution, onNext, showSolution }: SpanishKeyboardProps) {
  const specialChars = ['á', 'é', 'í', 'ó', 'ú', '¡', '!', '¿', '?'];
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
      className="bg-gray-100 dark:bg-gray-700 select-none"
      onTouchEnd={handleTouchEnd}
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

      {/* Third row with backspace */}
      <div className="flex justify-center">
        {['z', 'x', 'c', 'v', 'b', 'n', 'm'].map((key) => (
          <Key
            key={key}
            value={key}
            onPress={() => onKeyPress(key)}
            onMouseAction={handleMouseAction}
            onTouchAction={handleKeyAction}
          />
        ))}
        <Key
          value="⌫"
          onPress={onBackspace}
          onMouseAction={handleMouseAction}
          onTouchAction={handleKeyAction}
          variant="danger"
          disabled={showSolution}
          maxWidth="max-w-[60px]"
        />
      </div>

      {/* Space and enter row */}
      <div className="flex justify-center">
        <Key
          value={showSolution ? '→' : '💡'}
          onPress={showSolution ? onNext : onToggleSolution}
          onMouseAction={handleMouseAction}
          onTouchAction={handleKeyAction}
          variant="special"
          maxWidth="max-w-[60px]"
          className="text-xl"
        />
        <Key
          value="espacio"
          onPress={() => onKeyPress(' ')}
          onMouseAction={handleMouseAction}
          onTouchAction={handleKeyAction}
          flex="flex-[4]"
          maxWidth=""
        />
        <Key
          value="↵"
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
}
