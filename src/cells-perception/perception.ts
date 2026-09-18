/**
 * cell.perception — Sensor capture cells (audio + vision)
 *
 * Extracted from sunset-ecosystem/perception/{audio_capture,audio_encoder,capture,vision_encoder}.py
 *
 * Captures sensor frames as Quilt cells:
 *   - frame_id + content_hash
 *   - capture metadata (source, dimensions, sample rate)
 *   - encoding parameters
 *
 * Substrate-free: composes via BIND/LINK/EFFECT.
 */

export interface FrameCell {
  id: string;
  source: 'microphone' | 'system-audio' | 'camera' | 'screencap';
  format: 'pcm' | 'wav' | 'raw' | 'rgb' | 'rgba' | 'jpeg';
  width?: number;
  height?: number;
  sampleRate?: number;
  channels?: number;
  durationMs?: number;
  sizeBytes: number;
  contentHash: string;
  timestamp: number;
  witnessLog: Witness[];
}

export interface Witness {
  type: 'BIND' | 'CAPTURE' | 'ENCODE' | 'LINK';
  frameId: string;
  t: number;
  data?: any;
}

export interface PerceptionCell {
  id: string;
  frames: FrameCell[];
  totalBytes: number;
  tickCount: number;
}

export function createPerceptionCell(id: string = 'perception'): PerceptionCell {
  return { id, frames: [], totalBytes: 0, tickCount: 0 };
}

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16).padStart(8, '0').slice(0, 8);
}

export function captureFrame(
  cell: PerceptionCell,
  source: FrameCell['source'],
  format: FrameCell['format'],
  data: string | Uint8Array,
  options: {
    width?: number;
    height?: number;
    sampleRate?: number;
    channels?: number;
    durationMs?: number;
  } = {}
): FrameCell {
  const sizeBytes = typeof data === 'string' ? data.length : data.byteLength;
  const contentHash = simpleHash(typeof data === 'string' ? data : new TextDecoder().decode(data));
  const frame: FrameCell = {
    id: `frame-${cell.frames.length}-${Date.now()}`,
    source,
    format,
    width: options.width,
    height: options.height,
    sampleRate: options.sampleRate,
    channels: options.channels,
    durationMs: options.durationMs,
    sizeBytes,
    contentHash,
    timestamp: Date.now(),
    witnessLog: [
      { type: 'BIND', frameId: '', t: cell.tickCount++, data: { source, format, sizeBytes } },
      { type: 'CAPTURE', frameId: '', t: cell.tickCount++, data: { contentHash, dimensions: [options.width, options.height] } }
    ]
  };
  for (const w of frame.witnessLog) w.frameId = frame.id;
  cell.frames.push(frame);
  cell.totalBytes += sizeBytes;
  return frame;
}

export interface EncodeSpec {
  format: FrameCell['format'];
  bitrate?: number;
  quality?: number;
}

export function encodeFrame(cell: PerceptionCell, frameId: string, spec: EncodeSpec): FrameCell | null {
  const frame = cell.frames.find(f => f.id === frameId);
  if (!frame) return null;
  frame.format = spec.format;
  frame.witnessLog.push({
    type: 'ENCODE',
    frameId,
    t: cell.tickCount++,
    data: { format: spec.format, bitrate: spec.bitrate, quality: spec.quality }
  });
  return frame;
}

export function linkFrames(cell: PerceptionCell, frameIdA: string, frameIdB: string, linkType: string): boolean {
  const a = cell.frames.find(f => f.id === frameIdA);
  const b = cell.frames.find(f => f.id === frameIdB);
  if (!a || !b) return false;
  a.witnessLog.push({
    type: 'LINK',
    frameId: frameIdA,
    t: cell.tickCount++,
    data: { to: frameIdB, linkType }
  });
  b.witnessLog.push({
    type: 'LINK',
    frameId: frameIdB,
    t: cell.tickCount++,
    data: { from: frameIdA, linkType }
  });
  return true;
}

export function framesBySource(cell: PerceptionCell, source: FrameCell['source']): FrameCell[] {
  return cell.frames.filter(f => f.source === source);
}

export function recentFrames(cell: PerceptionCell, n: number): FrameCell[] {
  return cell.frames.slice(-n);
}

export function totalFrames(cell: PerceptionCell): number {
  return cell.frames.length;
}

export function averageFrameSize(cell: PerceptionCell): number {
  if (cell.frames.length === 0) return 0;
  return Math.round(cell.totalBytes / cell.frames.length);
}

export function sourceCounts(cell: PerceptionCell): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const f of cell.frames) {
    counts[f.source] = (counts[f.source] || 0) + 1;
  }
  return counts;
}
