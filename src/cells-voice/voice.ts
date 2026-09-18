/**
 * cell.voice — Voice interaction cells (ASR/TTS/VAD bridge)
 *
 * Extracted from sunset-ecosystem/voice/soniqo_bridge.py.
 *
 * Captures voice interactions as Quilt cells:
 *   - Audio hash (immutable transcript reference)
 *   - Speaker ID
 *   - Duration + confidence
 *   - VAD (voice activity detection) gating
 *
 * Substrate-free: composes via BIND/LINK/EFFECT.
 */

export interface VoiceTile {
  id: string;
  speaker: string;
  transcript: string;
  audioHash: string;
  durationMs: number;
  confidence: number;
  timestamp: number;
  vadActive: boolean;
  witnessLog: Witness[];
}

export interface Witness {
  type: 'BIND' | 'ASR' | 'TTS' | 'VAD' | 'SPEAK';
  tileId: string;
  t: number;
  data?: any;
}

export interface VoiceCell {
  id: string;
  tiles: VoiceTile[];
  speakers: Set<string>;
  totalDurationMs: number;
  tickCount: number;
}

export function createVoiceCell(id: string = 'voice'): VoiceCell {
  return {
    id,
    tiles: [],
    speakers: new Set(),
    totalDurationMs: 0,
    tickCount: 0
  };
}

export interface ASRInput {
  speaker: string;
  audioBuffer: Uint8Array | string;
  durationMs: number;
  confidence: number;
}

export function transcribe(cell: VoiceCell, input: ASRInput, transcript: string = ''): VoiceTile {
  const audioHash = simpleHash(typeof input.audioBuffer === 'string' ? input.audioBuffer : new TextDecoder().decode(input.audioBuffer));
  const tile: VoiceTile = {
    id: `voice-${cell.tiles.length}-${Date.now()}`,
    speaker: input.speaker,
    transcript,
    audioHash,
    durationMs: input.durationMs,
    confidence: input.confidence,
    timestamp: Date.now(),
    vadActive: input.durationMs > 0,
    witnessLog: [
      { type: 'BIND', tileId: '', t: cell.tickCount++, data: { speaker: input.speaker } },
      { type: 'VAD', tileId: '', t: cell.tickCount++, data: { durationMs: input.durationMs, active: input.durationMs > 0 } },
      { type: 'ASR', tileId: '', t: cell.tickCount++, data: { confidence: input.confidence, hash: audioHash } }
    ]
  };
  for (const w of tile.witnessLog) w.tileId = tile.id;
  cell.tiles.push(tile);
  cell.speakers.add(input.speaker);
  cell.totalDurationMs += input.durationMs;
  return tile;
}

export interface TTSRequest {
  text: string;
  voice: string;
}

export interface TTSResult {
  audioHash: string;
  durationMs: number;
  voice: string;
}

export function synthesize(cell: VoiceCell, request: TTSRequest): TTSResult {
  // Estimate duration: ~150 words per minute
  const wordCount = request.text.split(/\s+/).length;
  const durationMs = Math.ceil((wordCount / 150) * 60 * 1000);
  const audioHash = simpleHash(`${request.voice}:${request.text}`);
  cell.tickCount++;
  const lastTile = cell.tiles[cell.tiles.length - 1];
  if (lastTile) {
    lastTile.witnessLog.push({
      type: 'TTS',
      tileId: lastTile.id,
      t: cell.tickCount++,
      data: { voice: request.voice, wordCount, audioHash }
    });
  }
  return { audioHash, durationMs, voice: request.voice };
}

export function speakerTranscript(cell: VoiceCell, speaker: string): VoiceTile[] {
  return cell.tiles.filter(t => t.speaker === speaker);
}

export function transcriptsBySpeaker(cell: VoiceCell): Record<string, VoiceTile[]> {
  const out: Record<string, VoiceTile[]> = {};
  for (const t of cell.tiles) {
    if (!out[t.speaker]) out[t.speaker] = [];
    out[t.speaker].push(t);
  }
  return out;
}

export function lowConfidenceTranscripts(cell: VoiceCell, threshold: number = 0.7): VoiceTile[] {
  return cell.tiles.filter(t => t.confidence < threshold);
}

export function totalSpeakers(cell: VoiceCell): number {
  return cell.speakers.size;
}

export function averageConfidence(cell: VoiceCell): number {
  if (cell.tiles.length === 0) return 0;
  return cell.tiles.reduce((s, t) => s + t.confidence, 0) / cell.tiles.length;
}

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16).padStart(8, '0').slice(0, 8);
}
