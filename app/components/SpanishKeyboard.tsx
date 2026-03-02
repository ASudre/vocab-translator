interface SpanishKeyboardProps {
  onKeyPress: (key: string) => void;
  onBackspace: () => void;
  onEnter: () => void;
}

export function SpanishKeyboard({ onKeyPress, onBackspace, onEnter }: SpanishKeyboardProps) {
  const specialChars = ['á', 'é', 'í', 'ó', 'ú', '¿', '¡'];

  return (
    <div className="bg-gray-100 dark:bg-gray-700 p-1 space-y-2">
      {/* Special characters row */}
      <div className="flex justify-center gap-1 sm:gap-2">
        {specialChars.map((char) => (
          <button
            key={char}
            onClick={() => onKeyPress(char)}
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
            onClick={() => onKeyPress(key)}
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
            onClick={() => onKeyPress(key)}
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
            onClick={() => onKeyPress(key)}
            className="flex-1 max-w-[40px] sm:max-w-[50px] h-12 bg-white dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-lg font-semibold text-gray-900 dark:text-white transition-colors active:scale-95 shadow-sm"
          >
            {key}
          </button>
        ))}
        <button
          onClick={onBackspace}
          className="flex-1 max-w-[60px] h-12 bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 rounded-lg font-semibold text-white transition-colors active:scale-95 shadow-sm"
        >
          ⌫
        </button>
      </div>

      {/* Space and enter row */}
      <div className="flex justify-center gap-1 sm:gap-2">
        <button
          onClick={() => onKeyPress(' ')}
          className="flex-[4] h-12 bg-white dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-lg font-semibold text-gray-900 dark:text-white transition-colors active:scale-95 shadow-sm"
        >
          espacio
        </button>
        <button
          onClick={onEnter}
          className="flex-1 max-w-[80px] h-12 bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 rounded-lg font-semibold text-white transition-colors active:scale-95 shadow-sm"
        >
          ↵
        </button>
      </div>
    </div>
  );
}
