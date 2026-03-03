export const checkAnswerCorrectness = (
  userAnswer: string,
  correctAnswer: string
): boolean => {
  const normalizedUser = userAnswer.toLowerCase().trim();
  const normalizedCorrect = correctAnswer.toLowerCase().trim();
  
  return normalizedUser === normalizedCorrect;
};
