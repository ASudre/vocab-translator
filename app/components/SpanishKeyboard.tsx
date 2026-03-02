interface SpanishKeyboardProps {
  onKeyPress: (key: string) => void;
  onBackspace: () => void;
}

export function SpanishKeyboard({ onKeyPress, onBackspace }: SpanishKeyboardProps) {
  const rows = [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ñ'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
  ];

  const specialChars = ['á', 'é', 'í', 'ó', 'ú', '¿', '¡'];

  return (
    <div className="bg-gray-100 dark:bg-gray-700 rounded-xl p-3 sm:p-4 space-y-2">
      {/* Letter rows */}
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="flex justify-center gap-1 sm:gap-2">
          {row.map((key) => (
            <button
              key={key}
              onClick={() => onKeyPress(key)}
              className="flex-1 max-w-[40px] sm:max-w-[50px] h-10 sm:h-12 bg-white dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-lg font-semibold text-gray-900 dark:text-white transition-colors active:scale-95 shadow-sm"
            >
              {key}
            </button>
          ))}
        </div>
      ))}

      {/* Special characters row */}
      <div className="flex justify-center gap-1 sm:gap-2">
        {specialChars.map((char) => (
          <button
            key={char}
            onClick={() => onKeyPress(char)}
            className="flex-1 max-w-[40px] sm:max-w-[50px] h-10 sm:h-12 bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-700 rounded-lg font-semibold text-white transition-colors active:scale-95 shadow-sm"
          >
            {char}
          </button>
        ))}
      </div>

      {/* Space and backspace row */}
      <div className="flex justify-center gap-1 sm:gap-2">
        <button
          onClick={() => onKeyPress(' ')}
          className="flex-[3] h-10 sm:h-12 bg-white dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-lg font-semibold text-gray-900 dark:text-white transition-colors active:scale-95 shadow-sm"
        >
          espacio
        </button>
        <button
          onClick={onBackspace}
          className="flex-1 h-10 sm:h-12 bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 rounded-lg font-semibold text-white transition-colors active:scale-95 shadow-sm"
        >
          ⌫
        </button>
      </div>
    </div>
  );
}
