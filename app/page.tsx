'use client';

import { useState } from 'react';

interface WordItem {
  word: string;
  classes: string[];
}

interface TranslationResult {
  word: string;
  translations: string[];
  loading?: boolean;
  error?: string;
  userAnswer?: string;
  isCorrect?: boolean | null;
  showSolution?: boolean;
}

export default function Home() {
  const [words, setWords] = useState<TranslationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSolutions, setShowSolutions] = useState(false);

  const normalizeString = (str: string) => {
    return str
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  };

  const handleAnswerChange = (index: number, value: string) => {
    setWords(prevWords => {
      const newWords = [...prevWords];
      newWords[index] = {
        ...newWords[index],
        userAnswer: value,
        isCorrect: null
      };
      return newWords;
    });
  };

  const checkAnswer = (index: number) => {
    setWords(prevWords => {
      const newWords = [...prevWords];
      const word = newWords[index];
      const userAnswer = normalizeString(word.userAnswer || '');
      
      const isCorrect = word.translations.some(translation => 
        normalizeString(translation) === userAnswer
      );
      
      newWords[index] = {
        ...newWords[index],
        isCorrect
      };
      return newWords;
    });
  };

  const toggleSolution = (index: number) => {
    setWords(prevWords => {
      const newWords = [...prevWords];
      newWords[index] = {
        ...newWords[index],
        showSolution: !newWords[index].showSolution
      };
      return newWords;
    });
  };

  const getRandomWords = async () => {
    setLoading(true);
    setWords([]);
    setShowSolutions(false);

    try {
      const response = await fetch('/a1.json');
      const data = await response.json();
      const wordList: WordItem[] = data.list;

      const shuffled = [...wordList].sort(() => 0.5 - Math.random());
      const randomWords = shuffled.slice(0, 10);

      const initialWords: TranslationResult[] = randomWords.map(item => ({
        word: item.word,
        translations: [],
        loading: true,
        userAnswer: '',
        isCorrect: null,
        showSolution: false
      }));
      setWords(initialWords);

      const translationPromises = randomWords.map(async (item, index) => {
        try {
          const res = await fetch(`/api/translate?word=${encodeURIComponent(item.word)}`);
          const data = await res.json();
          
          return {
            index,
            word: item.word,
            translations: data.translations || [],
            error: data.error
          };
        } catch {
          return {
            index,
            word: item.word,
            translations: [],
            error: 'Failed to fetch translation'
          };
        }
      });

      const results = await Promise.all(translationPromises);
      
      setWords(prevWords => {
        const newWords = [...prevWords];
        results.forEach(result => {
          newWords[result.index] = {
            word: result.word,
            translations: result.translations,
            loading: false,
            error: result.error
          };
        });
        return newWords;
      });
    } catch (error) {
      console.error('Error loading vocabulary:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Vocabulary Translator
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            Learn English to Spanish translations
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={getRandomWords}
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-3 px-8 rounded-lg shadow-lg transition-all transform hover:scale-105 disabled:scale-100"
            >
              {loading ? 'Loading...' : 'Get 10 Random Words'}
            </button>
            {words.length > 0 && (
              <button
                onClick={() => setShowSolutions(!showSolutions)}
                className="bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 px-8 rounded-lg shadow-lg transition-all transform hover:scale-105"
              >
                {showSolutions ? 'Hide Solutions' : 'Show Solutions'}
              </button>
            )}
          </div>
        </div>

        {words.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6 border-b pb-4">
              Translations
            </h2>
            <div className="space-y-4">
              {words.map((result, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg transition-all ${
                    result.isCorrect === true
                      ? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-500'
                      : result.isCorrect === false
                      ? 'bg-red-50 dark:bg-red-900/20 border-2 border-red-500'
                      : 'bg-gray-50 dark:bg-gray-700'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-semibold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-lg text-gray-900 dark:text-white mb-3">
                        {result.word}
                      </div>
                      
                      {result.loading ? (
                        <span className="italic text-gray-500">Loading translation...</span>
                      ) : result.error ? (
                        <span className="text-red-500">{result.error}</span>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={result.userAnswer || ''}
                              onChange={(e) => handleAnswerChange(index, e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  checkAnswer(index);
                                }
                              }}
                              placeholder="Type Spanish translation..."
                              disabled={result.isCorrect === true}
                              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-900 disabled:cursor-not-allowed"
                            />
                            <button
                              onClick={() => checkAnswer(index)}
                              disabled={!result.userAnswer || result.isCorrect === true}
                              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
                            >
                              Check
                            </button>
                            <button
                              onClick={() => toggleSolution(index)}
                              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg transition-colors"
                            >
                              {result.showSolution ? 'Hide' : 'Solution'}
                            </button>
                          </div>
                          
                          {result.isCorrect === true && (
                            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-medium">
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              Correct!
                            </div>
                          )}
                          
                          {result.isCorrect === false && (
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-medium">
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                                Try again!
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                Hint: {result.translations.length > 0 ? `Starts with "${result.translations[0][0]}"` : 'No translation available'}
                              </div>
                            </div>
                          )}
                          
                          {result.isCorrect === true && result.translations.length > 1 && (
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              Other correct answers: {result.translations.filter(t => t.toLowerCase() !== result.userAnswer?.toLowerCase()).join(', ')}
                            </div>
                          )}
                          
                          {(showSolutions || result.showSolution) && result.translations.length > 0 && (
                            <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                              <div className="text-sm font-medium text-blue-900 dark:text-blue-100">
                                Solutions: <span className="text-blue-600 dark:text-blue-400">{result.translations.join(', ')}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {words.length === 0 && !loading && (
          <div className="text-center text-gray-500 dark:text-gray-400 mt-12">
            <p className="text-lg">Click the button above to start learning!</p>
          </div>
        )}
      </main>
    </div>
  );
}
