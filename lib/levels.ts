export const CEFR_LEVELS = ['a1', 'a2', 'b1', 'b2', 'c1'] as const;
export type CEFRLevel = (typeof CEFR_LEVELS)[number];
