export const checkAnswerCorrectness = (
  userAnswer: string,
  correctAnswer: string
): boolean => {
  const normalizedUser = userAnswer.toLowerCase().trim();
  const normalizedCorrect = correctAnswer.split(', ').map(a => a.toLowerCase().trim());
  
  return normalizedCorrect.includes(normalizedUser);
};
