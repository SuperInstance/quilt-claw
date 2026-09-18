/**
 * cell.music — Quilt cell-based composition
 *
 * Each cell = a beat. Note frequency derived from witness count.
 * Cells compose via LINK (chord), EFFECT (key change), TICK (tempo).
 * Substrate-free.
 */

export type Note = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
export type Mode = 'major' | 'minor' | 'pentatonic' | 'dorian' | 'lydian';

export interface MusicCell {
  id: string;
  witnessCount: number;
  pitch: Note;
  octave: number;
  velocity: number;
  duration: number;
  timestamp: number;
  witnessLog: Witness[];
}

export interface Witness {
  type: 'BIND' | 'LINK' | 'EFFECT' | 'TICK' | 'DEATH';
  cellId: string;
  t: number;
  data?: any;
}

export interface Composition {
  id: string;
  cells: MusicCell[];
  tempo: number;
  mode: Mode;
  rootNote: Note;
  tickCount: number;
}

const NOTE_FREQUENCIES: Record<Note, number> = {
  'C': 261.63, 'D': 293.66, 'E': 329.63, 'F': 349.23,
  'G': 392.00, 'A': 440.00, 'B': 493.88
};

const PENTATONIC_INTERVALS = [0, 2, 4, 7, 9];
const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10];

export function createComposition(id: string, tempo: number = 80, mode: Mode = 'pentatonic', rootNote: Note = 'D'): Composition {
  return { id, cells: [], tempo, mode, rootNote, tickCount: 0 };
}

export function cellNote(witnessCount: number, mode: Mode, rootNote: Note): { pitch: Note; octave: number } {
  const rootFreq = NOTE_FREQUENCIES[rootNote];
  let intervals: number[];
  if (mode === 'pentatonic') intervals = PENTATONIC_INTERVALS;
  else if (mode === 'major') intervals = MAJOR_INTERVALS;
  else if (mode === 'minor') intervals = MINOR_INTERVALS;
  else if (mode === 'dorian') intervals = [0, 2, 3, 5, 7, 9, 10];
  else intervals = [0, 2, 4, 6, 7, 9, 11];
  
  const notes: Note[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const totalInterval = witnessCount % (intervals.length * 3);
  const intervalIdx = totalInterval % intervals.length;
  const octaveShift = Math.floor(totalInterval / intervals.length);
  const semitones = intervals[intervalIdx] + (12 * octaveShift);
  
  const baseFreq = rootFreq * Math.pow(2, semitones / 12);
  let bestNote = rootNote;
  let bestOctave = octaveShift;
  let bestDist = Infinity;
  for (const n of notes) {
    const noteFreq = NOTE_FREQUENCIES[n];
    for (let oct = -2; oct <= 4; oct++) {
      const f = noteFreq * Math.pow(2, oct);
      const dist = Math.abs(Math.log2(f / baseFreq));
      if (dist < bestDist) {
        bestDist = dist;
        bestNote = n;
        bestOctave = oct + octaveShift;
      }
    }
  }
  return { pitch: bestNote, octave: bestOctave };
}

export function bindCell(comp: Composition): MusicCell {
  const w = comp.cells.length;
  const { pitch, octave } = cellNote(w, comp.mode, comp.rootNote);
  const cell: MusicCell = {
    id: `mcell-${w}-${Date.now()}`,
    witnessCount: w,
    pitch,
    octave,
    velocity: 0.5 + (w % 5) * 0.1,
    duration: 60000 / comp.tempo / 4,
    timestamp: Date.now(),
    witnessLog: [{
      type: 'BIND',
      cellId: '',
      t: comp.tickCount++,
      data: { witnessCount: w, pitch, octave }
    }]
  };
  cell.witnessLog[0].cellId = cell.id;
  comp.cells.push(cell);
  return cell;
}

export function effectCell(comp: Composition, cellId: string, newVelocity: number): MusicCell | null {
  const cell = comp.cells.find(c => c.id === cellId);
  if (!cell) return null;
  cell.velocity = newVelocity;
  cell.witnessLog.push({
    type: 'EFFECT',
    cellId,
    t: comp.tickCount++,
    data: { newVelocity }
  });
  return cell;
}

export function linkCells(comp: Composition, cellIdA: string, cellIdB: string, linkType: string): boolean {
  const a = comp.cells.find(c => c.id === cellIdA);
  const b = comp.cells.find(c => c.id === cellIdB);
  if (!a || !b) return false;
  a.witnessLog.push({ type: 'LINK', cellId: cellIdA, t: comp.tickCount++, data: { to: cellIdB, linkType } });
  b.witnessLog.push({ type: 'LINK', cellId: cellIdB, t: comp.tickCount++, data: { from: cellIdA, linkType } });
  return true;
}

export function compositionToJSON(comp: Composition): any {
  return {
    tempo: comp.tempo,
    mode: comp.mode,
    rootNote: comp.rootNote,
    cells: comp.cells.map(c => ({
      id: c.id, witnessCount: c.witnessCount, pitch: c.pitch, octave: c.octave,
      velocity: c.velocity, duration: c.duration
    }))
  };
}

export function renderScore(comp: Composition): string {
  const lines: string[] = [];
  lines.push(`X:1`);
  lines.push(`T:${comp.id}`);
  lines.push(`Q:${comp.tempo}`);
  lines.push(`M:4/4`);
  lines.push(`K:${comp.rootNote}`);
  lines.push(`L:1/16`);
  
  let measure = '';
  for (let i = 0; i < comp.cells.length; i++) {
    const c = comp.cells[i];
    const note = `${c.pitch}${c.octave}`;
    const dur = c.duration < 200 ? '/4' : c.duration < 400 ? '/2' : '';
    measure += `${note}${dur} `;
    if ((i + 1) % 16 === 0) {
      lines.push(measure.trim());
      measure = '';
    }
  }
  if (measure) lines.push(measure.trim());
  return lines.join('\n');
}

export function cellFrequency(cell: MusicCell): number {
  return NOTE_FREQUENCIES[cell.pitch] * Math.pow(2, cell.octave);
}

export function cellCount(comp: Composition): number {
  return comp.cells.length;
}
