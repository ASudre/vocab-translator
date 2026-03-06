import React from 'react';

interface KeyProps {
  value: string;
  onPress: () => void;
  onMouseAction: (e: React.MouseEvent, action: () => void) => void;
  onTouchAction: (e: React.TouchEvent, action: () => void) => void;
  variant?: 'default' | 'special' | 'action' | 'danger' | 'success';
  disabled?: boolean;
  className?: string;
  maxWidth?: string;
  flex?: string;
}

export function Key({
  value,
  onPress,
  onMouseAction,
  onTouchAction,
  variant = 'default',
  disabled = false,
  className = '',
  maxWidth = 'max-w-[40px] sm:max-w-[50px]',
  flex = 'flex-1'
}: KeyProps) {
  // Button takes full space with no gaps
  const buttonClasses = `${flex} ${maxWidth} h-14 px-0.5 py-1`;
  
  // Inner span has the visual styling with rounded corners
  const innerBaseClasses = 'w-full h-full flex items-center justify-center rounded-lg font-semibold text-xl transition-colors shadow-sm';
  
  const variantClasses = {
    default: 'bg-white dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 text-gray-900 dark:text-white',
    special: 'bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-700 text-white',
    action: 'bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white',
    danger: 'bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 text-white',
    success: 'bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 text-white'
  };
  
  const disabledClasses = disabled 
    ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed opacity-50' 
    : variantClasses[variant];

  return (
    <button
      data-key={value}
      onMouseDown={(e) => !disabled && onMouseAction(e, onPress)}
      onTouchStart={(e) => !disabled && onTouchAction(e, onPress)}
      disabled={disabled}
      className={buttonClasses}
    >
      <span className={`${innerBaseClasses} ${disabledClasses} ${className}`}>
        {value}
      </span>
    </button>
  );
}
