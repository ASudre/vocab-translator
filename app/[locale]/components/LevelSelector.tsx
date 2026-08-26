import { CEFR_LEVELS, CEFRLevel } from '@/hooks/useVocabularyDB';

interface LevelSelectorProps {
  level: CEFRLevel;
  onChange: (level: CEFRLevel) => void;
}

export function LevelSelector({ level, onChange }: LevelSelectorProps) {
  return (
    <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg p-2">
      <span className="text-lg">🇪🇸</span>
      <select
        value={level}
        onChange={(e) => onChange(e.target.value as CEFRLevel)}
        className="bg-transparent text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider focus:outline-none cursor-pointer"
      >
        {CEFR_LEVELS.map((lvl) => (
          <option key={lvl} value={lvl} className="normal-case">
            {lvl.toUpperCase()}
          </option>
        ))}
      </select>
    </div>
  );
}
