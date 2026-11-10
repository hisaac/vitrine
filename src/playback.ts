export class Playlist {
  readonly files: string[];
  private index = 0;

  constructor(files: string[], shuffle: boolean, random = Math.random) {
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    this.files = [...files].sort((a, b) => collator.compare(a, b) || a.localeCompare(b));
    if (shuffle) {
      for (let i = this.files.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [this.files[i], this.files[j]] = [this.files[j], this.files[i]];
      }
    }
  }
  get current(): string | undefined { return this.files[this.index]; }
  get position(): number { return this.index + 1; }
  get next(): string | undefined { return this.files[(this.index + 1) % this.files.length]; }
  move(direction: number): string | undefined {
    if (this.files.length) this.index = (this.index + direction + this.files.length) % this.files.length;
    return this.current;
  }
}

export interface Settings { folder: string; seconds: number; shuffle: boolean }
export function readSettings(raw: string | null): Settings {
  let value: Partial<Settings> = {};
  try { value = JSON.parse(raw ?? '{}') ?? {}; } catch { /* Recover corrupt settings. */ }
  return {
    folder: typeof value.folder === 'string' ? value.folder : '',
    seconds: typeof value.seconds === 'number' && Number.isFinite(value.seconds) && value.seconds >= 1 && value.seconds <= 3600 ? value.seconds : 30,
    shuffle: value.shuffle === true,
  };
}
