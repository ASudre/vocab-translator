'use client';

import { useState } from 'react';
import { supabase, VocabularyItem } from '@/lib/supabase';

interface TranslationResult {
  spanish: string;
  french: string;
  userAnswer?: string;
  isCorrect?: boolean | null;
  showSolution?: boolean;
}

export default function Home() {
  const [words, setWords] = useState<TranslationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSolutions, setShowSolutions] = useState(false);

  const normalizeString = (str: string) => {
    if(!str) return '';
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
      const correctAnswer = normalizeString(word.spanish);
      
      const isCorrect = userAnswer === correctAnswer;
      
      // Show solution only if normalized versions match but original versions don't (missing accent)
      const normalizedMatch = userAnswer === correctAnswer;
      const exactMatch = (word.userAnswer || '').toLowerCase().trim() === word.spanish.toLowerCase().trim();
      const showSolution = normalizedMatch && !exactMatch;
      
      newWords[index] = {
        ...newWords[index],
        isCorrect,
        showSolution
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
      // Fetch random words from Supabase using the stored function
      const { data, error } = await supabase
        .rpc('get_random_vocabulary', { word_count: 10 });

      if (error) {
        console.error('Error loading vocabulary:', error);
        return;
      }

      const vocabItems: TranslationResult[] = (data as VocabularyItem[]).map(item => ({
        spanish: item.spanish,
        french: item.french,
        userAnswer: '',
        isCorrect: null,
        showSolution: false
      }));
      
      setWords(vocabItems);
    } catch (error) {
      console.error('Error loading vocabulary:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <main className="container mx-auto px-4 py-6 sm:py-12 max-w-4xl">
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">
            Trouver la traduction
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-gray-600 dark:text-gray-300 mb-6 sm:mb-8">
            Trouver la traduction en français de la phrase en espagnol
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <button
              onClick={getRandomWords}
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-3 px-6 sm:px-8 rounded-lg shadow-lg transition-all transform hover:scale-105 disabled:scale-100 w-full sm:w-auto"
            >
              {loading ? 'Chargement...' : 'Afficher 10 nouveaux mots'}
            </button>
            {words.length > 0 && (
              <button
                onClick={() => setShowSolutions(!showSolutions)}
                className="bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 px-6 sm:px-8 rounded-lg shadow-lg transition-all transform hover:scale-105 w-full sm:w-auto"
              >
                {showSolutions ? 'Cacher les solutions' : 'Afficher les solutions'}
              </button>
            )}
          </div>
        </div>

        {words.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-4 sm:p-6 md:p-8">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white mb-4 sm:mb-6 border-b pb-3 sm:pb-4">
              Traductions
            </h2>
            <div className="space-y-3 sm:space-y-4">
              {words.map((result, index) => (
                <div
                  key={index}
                  className={`p-3 sm:p-4 rounded-lg transition-all ${
                    result.isCorrect === true
                      ? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-500'
                      : result.isCorrect === false
                      ? 'bg-red-50 dark:bg-red-900/20 border-2 border-red-500'
                      : 'bg-gray-50 dark:bg-gray-700'
                  }`}
                >
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-semibold text-sm sm:text-base">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-base sm:text-lg text-gray-900 dark:text-white mb-2 sm:mb-3">
                        {result.french}
                      </div>
                      
                      <div className="space-y-2">
                          <div className="flex flex-col sm:flex-row gap-2">
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
                              className="flex-1 px-3 py-2.5 sm:py-2 text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-900 disabled:cursor-not-allowed"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => checkAnswer(index)}
                                disabled={!result.userAnswer || result.isCorrect === true}
                                className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed text-sm sm:text-base"
                              >
                                Vérifier
                              </button>
                              <button
                                onClick={() => toggleSolution(index)}
                                className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg transition-colors text-sm sm:text-base"
                              >
                                {result.showSolution ? 'Cacher' : 'Solution'}
                              </button>
                            </div>
                          </div>
                          
                          {result.isCorrect === true && (
                            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-medium text-sm sm:text-base">
                              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              Correcte!
                            </div>
                          )}
                          
                          {result.isCorrect === false && (
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-medium text-sm sm:text-base">
                                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                                Réessayer!
                              </div>
                              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                                Indice: Commence par &quot;{result.spanish[0]}&quot;
                              </div>
                            </div>
                          )}
                          
                          {(showSolutions || result.showSolution) && (
                            <div className="mt-2 p-2 sm:p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                              <div className="text-xs sm:text-sm font-medium text-blue-900 dark:text-blue-100 break-words">
                                Solution: <span className="text-blue-600 dark:text-blue-400">{result.spanish}</span>
                              </div>
                            </div>
                          )}
                        </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {words.length === 0 && !loading && (
          <div className="text-center text-gray-500 dark:text-gray-400 mt-12">
            <p className="text-lg">Cliquez sur le bouton ci-dessus pour commencer à apprendre!</p>
          </div>
        )}
      </main>
    </div>
  );
}
