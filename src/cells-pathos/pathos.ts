/**
 * cell.pathos — Emotional/urgency state tracker for human operator needs
 *
 * Extracted from sunset-ecosystem/pathos/need_tracker.py + interaction_log.py.
 *
 * Tracks task, urgency, frustration, satisfaction, wait time.
 * Computes priority score for routing attention.
 */

export type Urgency = 'low' | 'medium' | 'high' | 'critical';
export type Satisfaction = 'negative' | 'neutral' | 'positive' | 'unknown';

export interface NeedState {
  task: string | null;
  urgency: Urgency;
  frustration: number;     // 0..1
  satisfaction: Satisfaction;
  waitTimeSeconds: number;
  lastUpdated: number;     // unix ms
}

export interface PathosCell {
  id: string;
  state: NeedState;
  history: NeedState[];
  tickCount: number;
}

export function createPathosCell(id: string = 'pathos'): PathosCell {
  return {
    id,
    state: {
      task: null,
      urgency: 'low',
      frustration: 0,
      satisfaction: 'unknown',
      waitTimeSeconds: 0,
      lastUpdated: Date.now()
    },
    history: [],
    tickCount: 0
  };
}

export function snapshot(cell: PathosCell): NeedState {
  const elapsed = (Date.now() - cell.state.lastUpdated) / 1000;
  return {
    ...cell.state,
    waitTimeSeconds: cell.state.waitTimeSeconds + elapsed
  };
}

export function recordHistory(cell: PathosCell): void {
  cell.history.push(snapshot(cell));
  if (cell.history.length > 100) cell.history.shift();
  cell.tickCount++;
}

export function setTask(cell: PathosCell, task: string): void {
  recordHistory(cell);
  cell.state.task = task;
  cell.state.urgency = 'medium';
  cell.state.lastUpdated = Date.now();
}

export function bumpUrgency(cell: PathosCell): void {
  recordHistory(cell);
  const order: Urgency[] = ['low', 'medium', 'high', 'critical'];
  const idx = order.indexOf(cell.state.urgency);
  if (idx < order.length - 1) {
    cell.state.urgency = order[idx + 1];
  }
  cell.state.lastUpdated = Date.now();
}

export function bumpFrustration(cell: PathosCell, amount: number = 0.1): void {
  recordHistory(cell);
  cell.state.frustration = Math.min(1, Math.max(0, cell.state.frustration + amount));
  if (cell.state.frustration > 0.7 && cell.state.urgency === 'low') {
    cell.state.urgency = 'medium';
  } else if (cell.state.frustration > 0.9) {
    cell.state.urgency = 'high';
  }
  cell.state.lastUpdated = Date.now();
}

export function setSatisfaction(cell: PathosCell, satisfaction: Satisfaction): void {
  recordHistory(cell);
  cell.state.satisfaction = satisfaction;
  if (satisfaction === 'positive') {
    cell.state.frustration = Math.max(0, cell.state.frustration - 0.3);
  } else if (satisfaction === 'negative') {
    bumpFrustration(cell, 0.2);
  }
  cell.state.lastUpdated = Date.now();
}

export function priority(cell: PathosCell): number {
  const urgencyScore = { low: 1, medium: 2, high: 3, critical: 4 }[cell.state.urgency];
  const satisfactionScore = { positive: 0, neutral: 0.5, unknown: 1, negative: 2 }[cell.state.satisfaction];
  return urgencyScore * (1 + cell.state.frustration) + satisfactionScore + Math.min(cell.state.waitTimeSeconds / 60, 1);
}

export function isCritical(cell: PathosCell): boolean {
  return cell.state.urgency === 'critical' || (cell.state.frustration > 0.95 && cell.state.satisfaction === 'negative');
}

export function calm(cell: PathosCell): void {
  recordHistory(cell);
  cell.state.frustration = 0;
  cell.state.urgency = 'low';
  cell.state.satisfaction = 'positive';
  cell.state.lastUpdated = Date.now();
}

export function summary(cell: PathosCell): string {
  return `${cell.id}: ${cell.state.task ?? '(idle)'} [${cell.state.urgency}] frustration=${cell.state.frustration.toFixed(2)} sat=${cell.state.satisfaction}`;
}
