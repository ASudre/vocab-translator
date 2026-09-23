/**
 * Talks to the Drive REST API directly via fetch - no Google SDK needed,
 * just an access token with this scope in the Authorization header.
 * drive.file (not the broader "drive" scope) limits the app to files it
 * creates itself, which is both safer and far less friction to get approved
 * by Google than full Drive access.
 */
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

export const BACKUP_FILE_NAME = 'palabras-backup.json';

const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';

export interface DriveFileRef {
  id: string;
  modifiedTime: string;
}

/** Finds this app's backup file, if one already exists (drive.file scope means this can only ever see files the app itself created). */
export const findBackupFile = async (accessToken: string): Promise<DriveFileRef | null> => {
  const query = encodeURIComponent(`name='${BACKUP_FILE_NAME}' and trashed=false`);
  const response = await fetch(
    `${DRIVE_FILES_URL}?q=${query}&spaces=drive&fields=files(id,modifiedTime)&orderBy=modifiedTime desc`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    throw new Error(`Failed to search Google Drive: ${response.statusText}`);
  }

  const data = await response.json();
  const file = data.files?.[0];
  return file ? { id: file.id, modifiedTime: file.modifiedTime } : null;
};

/**
 * Creates the backup file (fileId null) or overwrites an existing one's
 * content in place. Returns the file's id either way.
 */
export const uploadBackup = async (
  accessToken: string,
  fileId: string | null,
  payload: unknown
): Promise<string> => {
  const body = JSON.stringify(payload);

  if (fileId) {
    // Media-only update: content changes, metadata (name) doesn't.
    const response = await fetch(`${DRIVE_UPLOAD_URL}/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body,
    });
    if (!response.ok) {
      throw new Error(`Failed to update Drive backup: ${response.statusText}`);
    }
    return (await response.json()).id;
  }

  // Multipart create: metadata (the file's name) and media (its content) in one request.
  const boundary = 'palabras-backup-boundary';
  const metadata = JSON.stringify({ name: BACKUP_FILE_NAME, mimeType: 'application/json' });
  const multipartBody =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n` +
    `--${boundary}--`;

  const response = await fetch(`${DRIVE_UPLOAD_URL}?uploadType=multipart`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });
  if (!response.ok) {
    throw new Error(`Failed to create Drive backup: ${response.statusText}`);
  }
  return (await response.json()).id;
};

export const downloadBackup = async (accessToken: string, fileId: string): Promise<unknown> => {
  const response = await fetch(`${DRIVE_FILES_URL}/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Failed to download Drive backup: ${response.statusText}`);
  }
  return response.json();
};
