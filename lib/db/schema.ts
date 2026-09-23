import { boolean, index, integer, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Append-only event log. `id` is client-generated so a retried sync can
// never double-insert the same attempt (ON CONFLICT DO NOTHING on id).
export const attempts = pgTable('attempts', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  vocabularyId: integer('vocabulary_id').notNull(),
  level: text('level').notNull(),
  isCorrect: boolean('is_correct').notNull(),
  userAnswer: text('user_answer'),
  answeredAt: timestamp('answered_at', { withTimezone: true }).notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('attempts_user_answered_idx').on(table.userId, table.answeredAt),
  index('attempts_user_vocabulary_idx').on(table.userId, table.vocabularyId),
]);

// Derived cache, mirroring the IndexedDB UserProgress shape field-for-field
// so a pulled row can be written straight into IndexedDB. Always safe to
// rebuild from userWordBaseline + attempts (see lib/sync.ts).
export const userWordProgress = pgTable('user_word_progress', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  vocabularyId: integer('vocabulary_id').notNull(),
  successCount: integer('success_count').notNull(),
  failCount: integer('fail_count').notNull(),
  currentStreak: integer('current_streak').notNull(),
  bestStreak: integer('best_streak').notNull(),
  attemptHistory: boolean('attempt_history').array().notNull(),
  masteryLevel: integer('mastery_level').notNull(),
  lastPracticed: timestamp('last_practiced', { withTimezone: true }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.vocabularyId] }),
]);

// Immutable seed for progress that existed locally before the user had an
// account (no attempt log backs it). See lib/sync.ts `replayProgress`.
export const userWordBaseline = pgTable('user_word_baseline', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  vocabularyId: integer('vocabulary_id').notNull(),
  successCount: integer('success_count').notNull(),
  failCount: integer('fail_count').notNull(),
  currentStreak: integer('current_streak').notNull(),
  bestStreak: integer('best_streak').notNull(),
  attemptHistory: boolean('attempt_history').array().notNull(),
  masteryLevel: integer('mastery_level').notNull(),
  lastPracticed: timestamp('last_practiced', { withTimezone: true }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.vocabularyId] }),
]);
