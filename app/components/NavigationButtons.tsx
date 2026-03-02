interface NavigationButtonsProps {
  currentIndex: number;
  totalWords: number;
  onPrevious: () => void;
  onNext: () => void;
  onNewWords: () => void;
}

export function NavigationButtons({
  currentIndex,
  totalWords,
  onPrevious,
  onNext,
  onNewWords,
}: NavigationButtonsProps) {
  return (
    <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
      <button
        onClick={onPrevious}
        disabled={currentIndex === 0}
        className="px-4 py-2 text-indigo-600 dark:text-indigo-400 font-medium disabled:text-gray-400 disabled:cursor-not-allowed hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
      >
        ← Précédent
      </button>
      <button
        onClick={onNewWords}
        className="px-4 py-2 text-gray-600 dark:text-gray-400 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
      >
        🔄 Nouveaux mots
      </button>
      <button
        onClick={onNext}
        disabled={currentIndex === totalWords - 1}
        className="px-4 py-2 text-indigo-600 dark:text-indigo-400 font-medium disabled:text-gray-400 disabled:cursor-not-allowed hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
      >
        Suivant →
      </button>
    </div>
  );
}
