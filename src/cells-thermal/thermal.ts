/**
 * cell.thermal — heat-aware scheduling as canonical Quilt cell kind
 */

export interface ThermalTask {
  id: string;
  temp: number;
  work: number;
  done: number;
}

export interface ThermalCell {
  tasks: ThermalTask[];
  ambient: number;
  cooldown_rate: number;
  heat_rate: number;
  max_temp: number;
  tick_count: number;
}

export function createThermalCell(n: number = 10, ambient = 0.2): ThermalCell {
  const tasks: ThermalTask[] = Array.from({ length: n }, (_, i) => ({
    id: `t${i}`, temp: ambient, work: 1.0, done: 0
  }));
  return { tasks, ambient, cooldown_rate: 0.05, heat_rate: 0.3, max_temp: 5.0, tick_count: 0 };
}

export function stepThermal(cell: ThermalCell): { mean_temp: number; mean_progress: number } {
  for (const t of cell.tasks) {
    // heat from working
    t.temp += cell.heat_rate * (1 - t.done) * (1 - t.temp / cell.max_temp);
    // cool toward ambient
    t.temp -= cell.cooldown_rate * (t.temp - cell.ambient);
    // clamp to [0, max_temp]
    t.temp = Math.max(0, Math.min(cell.max_temp, t.temp));
    // work slows down as temperature rises
    const slowdown = Math.max(0.1, 1.0 - t.temp / cell.max_temp);
    t.done += slowdown * 0.01 * t.work;
    if (t.done >= 1.0) {
      t.done = 1.0;
      t.work = 0;
    }
  }
  cell.tick_count++;
  const mean_temp = cell.tasks.reduce((s, t) => s + t.temp, 0) / cell.tasks.length;
  const mean_progress = cell.tasks.reduce((s, t) => s + t.done, 0) / cell.tasks.length;
  return { mean_temp, mean_progress };
}
