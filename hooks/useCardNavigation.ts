import { useState, useCallback } from 'react';

export type SlideDirection = 'left' | 'right' | null;

export const useCardNavigation = (totalWords: number) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState<SlideDirection>(null);
  const [shakeAnimation, setShakeAnimation] = useState(false);

  const goToNext = useCallback(() => {
    if (currentIndex < totalWords - 1) {
      setSlideDirection('left');
      setTimeout(() => {
        setCurrentIndex(currentIndex + 1);
        setSlideDirection(null);
      }, 300);
    }
  }, [currentIndex, totalWords]);

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      setSlideDirection('right');
      setTimeout(() => {
        setCurrentIndex(currentIndex - 1);
        setSlideDirection(null);
      }, 300);
    }
  }, [currentIndex]);

  const triggerShake = useCallback(() => {
    setShakeAnimation(true);
    setTimeout(() => setShakeAnimation(false), 500);
  }, []);

  const autoAdvance = useCallback(() => {
    setTimeout(() => {
      if (currentIndex < totalWords - 1) {
        setSlideDirection('left');
        setTimeout(() => {
          setCurrentIndex(currentIndex + 1);
          setSlideDirection(null);
        }, 300);
      }
    }, 500);
  }, [currentIndex, totalWords]);

  const reset = useCallback(() => {
    setCurrentIndex(0);
    setSlideDirection(null);
    setShakeAnimation(false);
  }, []);

  return {
    currentIndex,
    slideDirection,
    shakeAnimation,
    goToNext,
    goToPrevious,
    triggerShake,
    autoAdvance,
    reset,
  };
};
