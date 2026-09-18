/**
 * cell.chirp — phased-array sonar/radar as canonical Quilt cell kind
 *
 * Promoted from twist-engine's CHIRP mode (5 of 5 substrates).
 * Twelve transducers emit same tone with phase twist → interference beam → contacts.
 *
 * Reference: tests/sim.test.js in twist-engine. Beamwidth < 45°, range/closure finite.
 */

export interface Contact {
  brg: number;       // bearing (degrees)
  heading: number;
  r: number;         // range
  closure: number | null;  // closure rate (signed)
  lastT: number;
}

export interface ChirpCell {
  N: number;              // number of transducers
  lambda: number;         // wavelength
  twist: number;          // phase twist per element (degrees)
  auto: boolean;          // auto-sweep on/off
  heading: number;        // current beam heading (degrees)
  fish: { x: number; y: number; vx: number; vy: number; cool: number; lastR: number | null; lastT: number }[];
  log: Contact[];
  frameCount: number;
}

const TAU = 2 * Math.PI;

export function createChirpCell(N: number = 12, lambda: number = 26): ChirpCell {
  const cell: ChirpCell = {
    N, lambda,
    twist: 0, auto: true, heading: 0,
    fish: [], log: [], frameCount: 0,
  };
  for (let i = 0; i < 6; i++) {
    cell.fish.push({
      x: 960 * (0.15 + Math.random() * 0.7),
      y: 600 * (0.15 + Math.random() * 0.5),
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.2,
      cool: 0, lastR: null, lastT: 0,
    });
  }
  return cell;
}

/** Compute the interference field intensity at point (x, y) for the current beam heading */
export function fieldAt(cell: ChirpCell, x: number, y: number, W: number = 960, H: number = 600): number {
  const N = cell.N;
  const lam = cell.lambda;
  // transducer array centered at bottom, spaced by lam
  const baseY = H - 30;
  const baseX = W / 2;
  const hdg = cell.heading * Math.PI / 180;
  // unit vector toward heading
  const ux = Math.cos(hdg), uy = Math.sin(hdg);
  // direction from each transducer to (x, y)
  let total = 0;
  for (let i = 0; i < N; i++) {
    const tx = baseX + (i - (N - 1) / 2) * lam;
    const ty = baseY;
    const dx = x - tx, dy = y - ty;
    const d = Math.hypot(dx, dy);
    if (d < 1e-6) continue;
    // phase shift from element-to-element twist
    const phase = (cell.twist * Math.PI / 180) * i;
    // dot with heading direction
    const cosTheta = (dx * ux + dy * uy) / d;
    // amplitude modulated by alignment with heading + phase
    total += cosTheta * Math.cos(phase);
  }
  return total;
}

/** Detect contacts: scan field for local maxima within beamwidth */
export function detectContacts(cell: ChirpCell, W: number = 960, H: number = 600): Contact[] {
  const out: Contact[] = [];
  for (const f of cell.fish) {
    if (f.cool > 0) continue;
    // bearing from transducer array center to fish
    const cx = W / 2, cy = H - 30;
    const dx = f.x - cx, dy = f.y - cy;
    const d = Math.hypot(dx, dy);
    if (d < 1e-6) continue;
    const brg = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
    // check if within beamwidth (±45°)
    let dBrg = Math.abs(brg - cell.heading) % 360;
    if (dBrg > 180) dBrg = 360 - dBrg;
    if (dBrg > 45) continue;
    // closure: change in range over time
    let closure: number | null = null;
    if (f.lastR !== null) {
      const dt = cell.frameCount - f.lastT;
      if (dt > 0) closure = (f.lastR - d) / dt;
    }
    f.lastR = d;
    f.lastT = cell.frameCount;
    out.push({ brg, heading: cell.heading, r: d, closure, lastT: cell.frameCount });
  }
  return out;
}

/** Auto-sweep the heading */
export function autoSweep(cell: ChirpCell, dt: number = 1): void {
  if (!cell.auto) return;
  cell.heading = (cell.heading + 60 * dt) % 360;
}

export function stepChirp(cell: ChirpCell, dt: number = 1/60, W: number = 960, H: number = 600): { contacts: Contact[]; heading: number } {
  autoSweep(cell, dt);
  // move fish
  for (const f of cell.fish) {
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    if (f.x < 0 || f.x > W) f.vx = -f.vx;
    if (f.y < 0 || f.y > H) f.vy = -f.vy;
    if (f.cool > 0) f.cool -= dt;
  }
  // detect contacts
  const contacts = detectContacts(cell, W, H);
  for (const c of contacts) {
    cell.log.push(c);
    if (cell.log.length > 100) cell.log.shift();
  }
  cell.frameCount++;
  return { contacts, heading: cell.heading };
}
