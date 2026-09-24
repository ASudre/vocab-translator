import { useCallback, useRef, useState } from 'react';
import { loadGoogleScript } from '@/lib/googleScript';
import { DRIVE_SCOPE, findBackupFile, uploadBackup, downloadBackup } from '@/lib/googleDrive';
import { buildBackupPayload, parseBackupPayload } from '@/lib/backup';
import { getAllUserProgress, restoreUserProgress } from '@/lib/indexedDB';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

export type DriveStatus =
  | 'idle'
  | 'requestingAccess'
  | 'uploading'
  | 'downloading'
  | 'backupSuccess'
  | 'restoreSuccess'
  | 'notFound'
  | 'invalid'
  | 'cancelled'
  | 'error';

interface TokenClient {
  requestAccessToken: () => void;
}

/**
 * A WhatsApp-style manual backup/restore of vocabulary progress to the
 * user's Google Drive (drive.file scope: only files this app itself
 * creates), not a live sync. Requesting Drive access is a separate consent
 * from sign-in (see hooks/useGoogleAuth.ts) since it's a broader
 * permission - Google prompts for it distinctly, the first time it's used.
 */
export const useGoogleDrive = () => {
  const [status, setStatus] = useState<DriveStatus>('idle');
  const tokenClientRef = useRef<TokenClient | null>(null);
  const pendingTokenRef = useRef<{ resolve: (token: string) => void; reject: (error: Error) => void } | null>(null);

  const getTokenClient = useCallback((): TokenClient | null => {
    if (!GOOGLE_CLIENT_ID || !window.google) return null;
    if (tokenClientRef.current) return tokenClientRef.current;

    tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        const pending = pendingTokenRef.current;
        pendingTokenRef.current = null;
        if (!pending) return;
        if (response.error || !response.access_token) {
          pending.reject(new Error(response.error || 'No access token returned'));
        } else {
          pending.resolve(response.access_token);
        }
      },
    });
    return tokenClientRef.current;
  }, []);

  /** Loads the shared GSI script on first use (see lib/googleScript.ts) so
   *  it's not fetched until the user actually asks for Drive backup/restore. */
  const getAccessToken = useCallback((): Promise<string> => {
    return loadGoogleScript().then(() => {
      const client = getTokenClient();
      if (!client) return Promise.reject(new Error('Google API not ready'));

      return new Promise<string>((resolve, reject) => {
        pendingTokenRef.current = { resolve, reject };
        client.requestAccessToken();
      });
    });
  }, [getTokenClient]);

  const backup = useCallback(async () => {
    setStatus('requestingAccess');
    try {
      const token = await getAccessToken();
      setStatus('uploading');
      const [allProgress, existing] = await Promise.all([getAllUserProgress(), findBackupFile(token)]);
      const payload = buildBackupPayload(allProgress);
      await uploadBackup(token, existing?.id ?? null, payload);
      setStatus('backupSuccess');
    } catch (error) {
      console.error('Google Drive backup failed:', error);
      setStatus('error');
    }
  }, [getAccessToken]);

  /**
   * `confirm` decides whether to actually overwrite local progress once the
   * backup's own exportedAt date is known - kept as a caller-supplied
   * function (rather than a hardcoded window.confirm) so the confirmation
   * copy stays in the component, where the rest of this page's i18n lives.
   */
  const restore = useCallback(async (confirm: (exportedAt: string) => boolean) => {
    setStatus('requestingAccess');
    try {
      const token = await getAccessToken();
      setStatus('downloading');
      const existing = await findBackupFile(token);
      if (!existing) {
        setStatus('notFound');
        return;
      }

      const raw = await downloadBackup(token, existing.id);
      const payload = parseBackupPayload(raw);
      if (!payload) {
        setStatus('invalid');
        return;
      }

      if (!confirm(payload.exportedAt)) {
        setStatus('cancelled');
        return;
      }

      await restoreUserProgress(payload.progress);
      setStatus('restoreSuccess');
    } catch (error) {
      console.error('Google Drive restore failed:', error);
      setStatus('error');
    }
  }, [getAccessToken]);

  return { status, backup, restore };
};
