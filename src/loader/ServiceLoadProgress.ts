export interface Progressable {
  progress: ServiceLoadProgress;
  onProgress: () => void;
}

export interface RawProgress {
  indeterminate: boolean;
  completed: number;
  total: number;
}

export class ServiceLoadProgress {
  indeterminate = true;
  completed = 0;
  total = 0;

  constructor(private owner: Progressable) {}

  determined(total: number) {
    this.completed = 0;
    this.indeterminate = false;
    this.total = total;
    this.owner.onProgress();
  }

  didWork(n = 1) {
    this.completed += n;
    this.completed = Math.min(Math.max(0, this.completed), this.total);
    this.owner.onProgress();
  }

  inspect(): RawProgress {
    return {
      indeterminate: this.indeterminate,
      completed: this.completed,
      total: this.total,
    };
  }
}