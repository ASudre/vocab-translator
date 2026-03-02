export const normalizeString = (str: string): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

export const checkAnswerCorrectness = (
  userAnswer: string,
  correctAnswer: string
): { isCorrect: boolean; showSolution: boolean } => {
  const normalizedUser = normalizeString(userAnswer);
  const normalizedCorrect = normalizeString(correctAnswer);
  
  const isCorrect = normalizedUser === normalizedCorrect;
  const exactMatch = userAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
  const showSolution = isCorrect && !exactMatch;
  
  return { isCorrect, showSolution };
};
