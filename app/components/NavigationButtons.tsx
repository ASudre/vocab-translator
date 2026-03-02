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
    <div className="flex justify-center items-center gap-3 mt-6">
      {/* Previous button */}
      <button
        onClick={onPrevious}
        disabled={currentIndex === 0}
        className="w-10 h-10 flex items-center justify-center bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 disabled:text-gray-300 dark:disabled:text-gray-600 disabled:cursor-not-allowed hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-full transition-all shadow-sm hover:shadow-md disabled:shadow-none"
        title="Précédent"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* New words button */}
      <button
        onClick={onNewWords}
        className="px-4 py-2 flex items-center gap-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-full transition-all shadow-sm hover:shadow-md text-sm font-medium"
        title="Charger de nouveaux mots"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <span>Nouveaux</span>
      </button>

      {/* Next button */}
      <button
        onClick={onNext}
        disabled={currentIndex === totalWords - 1}
        className="w-10 h-10 flex items-center justify-center bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 disabled:text-gray-300 dark:disabled:text-gray-600 disabled:cursor-not-allowed hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-full transition-all shadow-sm hover:shadow-md disabled:shadow-none"
        title="Suivant"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
