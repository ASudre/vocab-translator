import { describe, it, expect, vi, afterEach } from 'vitest';
import { BACKUP_FILE_NAME, findBackupFile, uploadBackup, downloadBackup } from '@/lib/googleDrive';

const mockFetch = (response: Partial<Response> & { json?: () => Promise<unknown> }) => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    statusText: 'OK',
    ...response,
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('findBackupFile', () => {
  it('returns the first matching file when one exists', async () => {
    mockFetch({ json: () => Promise.resolve({ files: [{ id: 'file-1', modifiedTime: '2026-01-01T00:00:00.000Z' }] }) });

    const result = await findBackupFile('token-abc');
    expect(result).toEqual({ id: 'file-1', modifiedTime: '2026-01-01T00:00:00.000Z' });
  });

  it('returns null when no backup file exists yet', async () => {
    mockFetch({ json: () => Promise.resolve({ files: [] }) });
    expect(await findBackupFile('token-abc')).toBeNull();
  });

  it('sends the access token as a bearer header and searches by name', async () => {
    const fetchMock = mockFetch({ json: () => Promise.resolve({ files: [] }) });

    await findBackupFile('token-abc');

    const [url, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer token-abc');
    expect(url).toContain(encodeURIComponent(BACKUP_FILE_NAME));
  });

  it('throws when the request fails', async () => {
    mockFetch({ ok: false, statusText: 'Unauthorized' });
    await expect(findBackupFile('token-abc')).rejects.toThrow('Unauthorized');
  });
});

describe('uploadBackup', () => {
  it('creates a new file (multipart POST) when no fileId is given', async () => {
    const fetchMock = mockFetch({ json: () => Promise.resolve({ id: 'new-file-id' }) });

    const id = await uploadBackup('token-abc', null, { version: 1 });

    expect(id).toBe('new-file-id');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('uploadType=multipart');
    expect(init.method).toBe('POST');
    expect(init.body).toContain('"version":1');
  });

  it('updates the existing file (media PATCH) when a fileId is given', async () => {
    const fetchMock = mockFetch({ json: () => Promise.resolve({ id: 'file-1' }) });

    const id = await uploadBackup('token-abc', 'file-1', { version: 1 });

    expect(id).toBe('file-1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('file-1');
    expect(url).toContain('uploadType=media');
    expect(init.method).toBe('PATCH');
    expect(init.body).toBe(JSON.stringify({ version: 1 }));
  });

  it('throws when the upload fails', async () => {
    mockFetch({ ok: false, statusText: 'Quota exceeded' });
    await expect(uploadBackup('token-abc', null, {})).rejects.toThrow('Quota exceeded');
  });
});

describe('downloadBackup', () => {
  it('returns the parsed JSON content of the file', async () => {
    mockFetch({ json: () => Promise.resolve({ version: 1, progress: [] }) });
    expect(await downloadBackup('token-abc', 'file-1')).toEqual({ version: 1, progress: [] });
  });

  it('requests the file content (alt=media) with the bearer token', async () => {
    const fetchMock = mockFetch({ json: () => Promise.resolve({}) });

    await downloadBackup('token-abc', 'file-1');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('file-1');
    expect(url).toContain('alt=media');
    expect(init.headers.Authorization).toBe('Bearer token-abc');
  });

  it('throws when the download fails', async () => {
    mockFetch({ ok: false, statusText: 'Not Found' });
    await expect(downloadBackup('token-abc', 'missing')).rejects.toThrow('Not Found');
  });
});
