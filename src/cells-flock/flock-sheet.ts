/**
 * cell.flock.LINK(sheet) — flock cell embedded in Quilt sheet
 *
 * Per the debate: cell.flock is canonical IF AND ONLY IF it composes.
 * This implements the composition.
 */

import { createFlockCell, stepFlock } from './flock';

export interface SheetAddress {
  x: number;
  y: number;
}

export interface QuiltSheet {
  cells: Map<string, any>;  // address → cell
  witnesses: any[];
}

export interface FlockSheetLink {
  sheet: QuiltSheet;
  flockCell: ReturnType<typeof createFlockCell>;
  birdAddressMap: Map<number, string>;  // bird index → sheet address
  sheetBounds: { W: number; H: number };
}

export function linkFlockToSheet(sheet: QuiltSheet, fiction: any = 'murmuration', n = 100): FlockSheetLink {
  const W = 960, H = 600;
  const flockCell = createFlockCell(fiction, n, W, H);
  const birdAddressMap = new Map<number, string>();
  for (let i = 0; i < flockCell.birds.length; i++) {
    const addr = `flock/bird/${i}`;
    birdAddressMap.set(i, addr);
    sheet.cells.set(addr, {
      type: 'flock-bird',
      fiction,
      x: flockCell.birds[i].x,
      y: flockCell.birds[i].y,
      vx: flockCell.birds[i].vx,
      vy: flockCell.birds[i].vy,
      witness: { type: 'BIND', address: addr, time: 0 }
    });
  }
  return { sheet, flockCell, birdAddressMap, sheetBounds: { W, H } };
}

export function tickLinkedFlock(link: FlockSheetLink, dt: number = 1/60): { sheet_witnesses: any[]; pol: number } {
  stepFlock(link.flockCell, dt);
  // BIND each bird's new state into the sheet
  for (const [birdIdx, addr] of link.birdAddressMap) {
    const bird = link.flockCell.birds[birdIdx];
    const cell = link.sheet.cells.get(addr);
    if (cell) {
      cell.x = bird.x;
      cell.y = bird.y;
      cell.vx = bird.vx;
      cell.vy = bird.vy;
      cell.witness = { type: 'BIND', address: addr, time: Date.now() };
      link.sheet.witnesses.push(cell.witness);
    }
  }
  return { sheet_witnesses: link.sheet.witnesses, pol: link.flockCell.pol };
}

export function flockSheetNeighbors(link: FlockSheetLink, address: string, radius: number = 46): string[] {
  const bird = link.sheet.cells.get(address);
  if (!bird) return [];
  const neighbors: string[] = [];
  for (const [birdIdx, addr] of link.birdAddressMap) {
    if (addr === address) continue;
    const other = link.sheet.cells.get(addr);
    const d = Math.hypot(bird.x - other.x, bird.y - other.y);
    if (d < radius) neighbors.push(addr);
  }
  return neighbors;
}
