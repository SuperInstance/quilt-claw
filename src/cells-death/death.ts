/**
 * cell.death — apoptotic lifecycle (the first spoke-6 experiment)
 *
 * Promoted from "what if cells died?" (spoke 6 of the wheel).
 */

export interface DyingCell {
  born: number;
  lifespan: number;
  witnessLog: { type: string; age?: number; witness?: any }[];
  state: 'alive' | 'dying' | 'dead';
}

export function createDyingCell(lifespan: number = 1000): DyingCell {
  return { born: Date.now(), lifespan, witnessLog: [], state: 'alive' };
}

export function tickDyingCell(cell: DyingCell): void {
  if (cell.state === 'dead') return;
  const age = Date.now() - cell.born;
  if (age > cell.lifespan) {
    cell.state = 'dying';
    const final = cell.witnessLog[cell.witnessLog.length - 1];
    cell.witnessLog.push({ type: 'DEATH', witness: final, age });
    cell.state = 'dead';
    cell.witnessLog = [];
    cell.born = 0;
  } else {
    cell.witnessLog.push({ type: 'TICK', age });
  }
}

export function witnessCount(cell: DyingCell): number {
  return cell.witnessLog.length;
}

export function isAlive(cell: DyingCell): boolean {
  return cell.state === 'alive';
}
