/**
 * cell.world — Wanderer JEPA + calibrator for room latents
 *
 * Extracted from sunset-ecosystem/nerve/world_model.py (WanderingJEPA + Calibrator).
 *
 * A small mobile predictor that bounces between rooms. Predicts room B's
 * latent from room A's. Measures prediction error to detect drift.
 *
 * Without torch — pure JS linear regression.
 */

export interface RoomLatent {
  roomId: string;
  latent: number[];     // dim-length vector
  lastUpdate: number;
}

export interface PredictionError {
  fromRoom: string;
  toRoom: string;
  error: number;
  predicted: number[];
  actual: number[];
  timestamp: number;
}

export interface WorldCell {
  id: string;
  predictorWeights: number[][];  // [latent_dim × hidden_dim]
  predictorBias: number[];       // [hidden_dim]
  outputWeights: number[][];     // [hidden_dim × latent_dim]
  outputBias: number[];          // [latent_dim]
  rooms: Map<string, RoomLatent>;
  errors: PredictionError[];
  driftThreshold: number;
  tickCount: number;
}

export interface WorldCellOptions {
  latentDim?: number;
  hiddenDim?: number;
  driftThreshold?: number;
}

export function createWorldCell(id: string = 'world', opts: WorldCellOptions = {}): WorldCell {
  const ld = opts.latentDim ?? 8;
  const hd = opts.hiddenDim ?? 16;
  const weights: number[][] = [];
  for (let i = 0; i < ld; i++) {
    const row: number[] = [];
    for (let j = 0; j < hd; j++) row.push((Math.random() - 0.5) * 0.1);
    weights.push(row);
  }
  const outputW: number[][] = [];
  for (let i = 0; i < ld; i++) {
    const row: number[] = [];
    for (let j = 0; j < hd; j++) row.push((Math.random() - 0.5) * 0.1);
    outputW.push(row);
  }
  return {
    id,
    predictorWeights: weights,
    predictorBias: new Array(hd).fill(0),
    outputWeights: outputW,
    outputBias: new Array(ld).fill(0),
    rooms: new Map(),
    errors: [],
    driftThreshold: opts.driftThreshold ?? 0.5,
    tickCount: 0
  };
}

function relu(x: number): number { return x > 0 ? x : 0; }

function matVecMul(W: number[][], x: number[], b: number[]): number[] {
  const out = new Array(W.length).fill(0);
  for (let i = 0; i < W.length; i++) {
    let s = b[i] ?? 0;
    for (let j = 0; j < x.length; j++) s += W[i][j] * (x[j] ?? 0);
    out[i] = s;
  }
  return out;
}

export function predict(cell: WorldCell, input: number[]): number[] {
  const hidden = matVecMul(cell.predictorWeights, input, cell.predictorBias).map(relu);
  return matVecMul(cell.outputWeights, hidden, cell.outputBias);
}

export function registerRoom(cell: WorldCell, roomId: string, latent: number[]): void {
  cell.rooms.set(roomId, {
    roomId,
    latent,
    lastUpdate: Date.now()
  });
  cell.tickCount++;
}

export function observeAndPredict(cell: WorldCell, fromRoom: string, toRoom: string): PredictionError | null {
  const a = cell.rooms.get(fromRoom);
  const b = cell.rooms.get(toRoom);
  if (!a || !b) return null;
  const predicted = predict(cell, a.latent);
  let err = 0;
  for (let i = 0; i < b.latent.length; i++) {
    const d = (b.latent[i] ?? 0) - (predicted[i] ?? 0);
    err += d * d;
  }
  const error = Math.sqrt(err);
  const pe: PredictionError = {
    fromRoom,
    toRoom,
    error,
    predicted,
    actual: b.latent,
    timestamp: Date.now()
  };
  cell.errors.push(pe);
  if (cell.errors.length > 1000) cell.errors.shift();
  cell.tickCount++;
  return pe;
}

export function calibrateRoom(cell: WorldCell, roomId: string): RoomLatent | null {
  const room = cell.rooms.get(roomId);
  if (!room) return null;
  // Average prediction errors
  const relevantErrors = cell.errors.filter(e => e.fromRoom === roomId || e.toRoom === roomId);
  if (relevantErrors.length === 0) return room;
  const ld = room.latent.length;
  const adjusted = [...room.latent];
  for (const e of relevantErrors) {
    for (let i = 0; i < ld; i++) {
      const diff = (e.actual[i] ?? 0) - (e.predicted[i] ?? 0);
      adjusted[i] = (adjusted[i] ?? 0) + diff * 0.1;
    }
  }
  room.latent = adjusted;
  room.lastUpdate = Date.now();
  cell.rooms.set(roomId, room);
  return room;
}

export function detectDrift(cell: WorldCell, roomId: string): boolean {
  const recentErrors = cell.errors.slice(-20).filter(e => e.toRoom === roomId);
  if (recentErrors.length === 0) return false;
  const avg = recentErrors.reduce((s, e) => s + e.error, 0) / recentErrors.length;
  return avg > cell.driftThreshold;
}

export function reset(cell: WorldCell): void {
  cell.errors = [];
  cell.tickCount++;
}

export function recentErrors(cell: WorldCell, n: number = 10): PredictionError[] {
  return cell.errors.slice(-n);
}

export function averageError(cell: WorldCell): number {
  if (cell.errors.length === 0) return 0;
  return cell.errors.reduce((s, e) => s + e.error, 0) / cell.errors.length;
}

export function roomCount(cell: WorldCell): number {
  return cell.rooms.size;
}
