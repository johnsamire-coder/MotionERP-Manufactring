/** The four ways to compute a project's percent complete (plan item 44), pure. */
export type PercentMethod = 'manual' | 'task_completion' | 'task_progress' | 'task_weight';
export interface TaskProgress {
  status: string;
  progress: number;
  weight: number;
}

export function percentComplete(
  method: PercentMethod,
  tasks: TaskProgress[],
  manual: number | null,
): number {
  const live = tasks.filter((t) => t.status !== 'cancelled');
  const round = (n: number): number => Number(n.toFixed(2));
  switch (method) {
    case 'manual':
      return round(manual ?? 0);
    case 'task_completion':
      return live.length === 0
        ? 0
        : round((live.filter((t) => t.status === 'completed').length / live.length) * 100);
    case 'task_progress':
      return live.length === 0
        ? 0
        : round(
            live.reduce((s, t) => s + (t.status === 'completed' ? 100 : t.progress), 0) /
              live.length,
          );
    case 'task_weight': {
      const w = live.reduce((s, t) => s + t.weight, 0);
      return w === 0
        ? 0
        : round(
            live.reduce((s, t) => s + (t.status === 'completed' ? 100 : t.progress) * t.weight, 0) /
              w,
          );
    }
  }
}

/** Whether a periodic report is due (pure). */
export function reportDue(frequency: string, last: Date | null, now: Date): boolean {
  if (frequency === 'none') return false;
  if (!last) return true;
  const days = frequency === 'daily' ? 1 : frequency === 'weekly' ? 7 : 30;
  return now.getTime() - last.getTime() >= days * 86_400_000 - 60_000;
}
