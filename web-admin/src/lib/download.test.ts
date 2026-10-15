import { describe, expect, it, vi } from 'vitest';
import { taxReportFilename, triggerBlobDownload, type DownloadEnv } from './download';

function fakeEnv() {
  const anchor = { href: '', download: '', click: vi.fn() };
  const env = {
    document: {
      createElement: vi.fn(() => anchor),
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
    },
    url: { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() },
  };
  return { anchor, env };
}

describe('triggerBlobDownload', () => {
  it('clicks a temporary anchor and cleans up', () => {
    const { anchor, env } = fakeEnv();
    const blob = new Blob(['a,b'], { type: 'text/csv' });
    triggerBlobDownload(blob, 'r.csv', env as unknown as DownloadEnv);
    expect(env.url.createObjectURL).toHaveBeenCalledWith(blob);
    expect(anchor.href).toBe('blob:x');
    expect(anchor.download).toBe('r.csv');
    expect(anchor.click).toHaveBeenCalledOnce();
    expect(env.document.body.removeChild).toHaveBeenCalledWith(anchor);
    expect(env.url.revokeObjectURL).toHaveBeenCalledWith('blob:x');
  });

  it('cleans up even when click throws', () => {
    const { anchor, env } = fakeEnv();
    anchor.click.mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => triggerBlobDownload(new Blob([]), 'r.csv', env as unknown as DownloadEnv)).toThrow('blocked');
    expect(env.url.revokeObjectURL).toHaveBeenCalled();
  });
});

describe('taxReportFilename', () => {
  it('includes the month', () => {
    expect(taxReportFilename('2026-10')).toBe('soliq-1foiz-2026-10.csv');
  });
});
