import { and, eq, inArray } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { attempts as attemptsTable, userWordBaseline, userWordProgress } from '@/lib/db/schema';
import { getSession } from '@/lib/auth/requireSession';
import { AttemptRecord, BaselineProgress, pickBaseline, replayProgress } from '@/lib/sync';

export const runtime = 'nodejs';

interface SyncRequestBody {
  attempts?: AttemptRecord[];
  baseline?: (BaselineProgress & { vocabularyId: number })[];
}

const isAttemptRecord = (value: unknown): value is AttemptRecord => {
  if (typeof value !== 'object' || value === null) return false;
  const a = value as Record<string, unknown>;
  return (
    typeof a.id === 'string' &&
    typeof a.vocabularyId === 'number' &&
    typeof a.level === 'string' &&
    typeof a.isCorrect === 'boolean' &&
    typeof a.answeredAt === 'string'
  );
};

const rowToBaseline = (row: {
  successCount: number; failCount: number; currentStreak: number; bestStreak: number;
  attemptHistory: boolean[]; masteryLevel: number; lastPracticed: Date;
}): BaselineProgress => ({
  vocabularyId: 0, // caller overwrites
  successCount: row.successCount,
  failCount: row.failCount,
  currentStreak: row.currentStreak,
  bestStreak: row.bestStreak,
  attemptHistory: row.attemptHistory,
  masteryLevel: row.masteryLevel,
  lastPracticed: row.lastPracticed.toISOString(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const userId = session.userId;

  let body: SyncRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const incomingAttempts = (body.attempts ?? []).filter(isAttemptRecord);
  const incomingBaseline = body.baseline ?? [];

  // 1. Append new attempts. `id` is client-generated, so a retried push is idempotent.
  if (incomingAttempts.length > 0) {
    await db.insert(attemptsTable).values(
      incomingAttempts.map(a => ({
        id: a.id,
        userId,
        vocabularyId: a.vocabularyId,
        level: a.level,
        isCorrect: a.isCorrect,
        userAnswer: a.userAnswer ?? null,
        answeredAt: new Date(a.answeredAt),
      }))
    ).onConflictDoNothing({ target: attemptsTable.id });
  }

  // 2. Merge incoming baseline rows against whatever baseline already exists,
  //    keeping whichever reflects more practice (see lib/sync.ts pickBaseline).
  if (incomingBaseline.length > 0) {
    const vocabularyIds = incomingBaseline.map(b => b.vocabularyId);
    const existingBaselineRows = await db
      .select()
      .from(userWordBaseline)
      .where(and(eq(userWordBaseline.userId, userId), inArray(userWordBaseline.vocabularyId, vocabularyIds)));
    const existingByVocabId = new Map(existingBaselineRows.map(r => [r.vocabularyId, r]));

    for (const incoming of incomingBaseline) {
      const existing = existingByVocabId.get(incoming.vocabularyId);
      const winner = existing ? pickBaseline(rowToBaseline(existing), incoming) : incoming;

      await db
        .insert(userWordBaseline)
        .values({
          userId,
          vocabularyId: incoming.vocabularyId,
          successCount: winner.successCount,
          failCount: winner.failCount,
          currentStreak: winner.currentStreak,
          bestStreak: winner.bestStreak,
          attemptHistory: winner.attemptHistory,
          masteryLevel: winner.masteryLevel,
          lastPracticed: new Date(winner.lastPracticed),
        })
        .onConflictDoUpdate({
          target: [userWordBaseline.userId, userWordBaseline.vocabularyId],
          set: {
            successCount: winner.successCount,
            failCount: winner.failCount,
            currentStreak: winner.currentStreak,
            bestStreak: winner.bestStreak,
            attemptHistory: winner.attemptHistory,
            masteryLevel: winner.masteryLevel,
            lastPracticed: new Date(winner.lastPracticed),
          },
        });
    }
  }

  // 3. Recompute the aggregate for every word touched by this request, by
  //    replaying its baseline + its full attempt history (not just this
  //    batch) — see lib/sync.ts replayProgress for why a full replay rather
  //    than an incremental update is what makes this safe.
  const touchedVocabularyIds = Array.from(new Set([
    ...incomingAttempts.map(a => a.vocabularyId),
    ...incomingBaseline.map(b => b.vocabularyId),
  ]));

  if (touchedVocabularyIds.length > 0) {
    const [baselineRows, attemptRows] = await Promise.all([
      db.select().from(userWordBaseline)
        .where(and(eq(userWordBaseline.userId, userId), inArray(userWordBaseline.vocabularyId, touchedVocabularyIds))),
      db.select().from(attemptsTable)
        .where(and(eq(attemptsTable.userId, userId), inArray(attemptsTable.vocabularyId, touchedVocabularyIds))),
    ]);

    const baselineByVocabId = new Map(baselineRows.map(r => [r.vocabularyId, rowToBaseline(r)]));
    const attemptsByVocabId = new Map<number, AttemptRecord[]>();
    for (const row of attemptRows) {
      const list = attemptsByVocabId.get(row.vocabularyId) ?? [];
      list.push({
        id: row.id,
        vocabularyId: row.vocabularyId,
        level: row.level,
        isCorrect: row.isCorrect,
        userAnswer: row.userAnswer,
        answeredAt: row.answeredAt.toISOString(),
      });
      attemptsByVocabId.set(row.vocabularyId, list);
    }

    for (const vocabularyId of touchedVocabularyIds) {
      const replayed = replayProgress(baselineByVocabId.get(vocabularyId), attemptsByVocabId.get(vocabularyId) ?? []);
      if (!replayed) continue;

      await db
        .insert(userWordProgress)
        .values({
          userId,
          vocabularyId,
          successCount: replayed.successCount,
          failCount: replayed.failCount,
          currentStreak: replayed.currentStreak,
          bestStreak: replayed.bestStreak,
          attemptHistory: replayed.attemptHistory,
          masteryLevel: replayed.masteryLevel,
          lastPracticed: new Date(replayed.lastPracticed),
        })
        .onConflictDoUpdate({
          target: [userWordProgress.userId, userWordProgress.vocabularyId],
          set: {
            successCount: replayed.successCount,
            failCount: replayed.failCount,
            currentStreak: replayed.currentStreak,
            bestStreak: replayed.bestStreak,
            attemptHistory: replayed.attemptHistory,
            masteryLevel: replayed.masteryLevel,
            lastPracticed: new Date(replayed.lastPracticed),
          },
        });
    }
  }

  // 4. Return the full snapshot; the client merges it into IndexedDB
  //    (server rows win, local-only rows are kept — see hooks/useSync.ts).
  const allProgress = await db.select().from(userWordProgress).where(eq(userWordProgress.userId, userId));

  return NextResponse.json({
    progress: allProgress.map(row => ({
      vocabularyId: row.vocabularyId,
      successCount: row.successCount,
      failCount: row.failCount,
      currentStreak: row.currentStreak,
      bestStreak: row.bestStreak,
      attemptHistory: row.attemptHistory,
      masteryLevel: row.masteryLevel,
      lastPracticed: row.lastPracticed.toISOString(),
    })),
  });
}
