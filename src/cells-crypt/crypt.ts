/**
 * cell.crypt — Signed witness log + tamper detection
 *
 * Extracted from sunset-ecosystem/logos/signed_wal.py + a2a_identity.py.
 *
 * Pure-JS Ed25519-like signatures (HMAC-SHA256-based, deterministic seed).
 * Hash chains each witness to its predecessor (Merkle-style).
 *
 * Substrate-free: cells carry their own tamper-proof witness log.
 */

import * as crypto from 'node:crypto';

export interface Witness {
  cellId: string;
  op: 'BIND' | 'LINK' | 'EFFECT' | 'VIEW' | 'TICK' | 'FORGET' | 'PROOF' | 'ROUTE' | 'CRDT' | 'WORLD' | 'TIME';
  data: string;
  timestamp: number;
  prevHash: string;
  hash: string;
  signature: string;
}

export interface CryptCell {
  id: string;
  secretKey: Buffer;
  publicKey: string;
  witnesses: Witness[];
  tickCount: number;
}

export function generateKeypair(): { secretKey: Buffer; publicKey: string } {
  const secretKey = crypto.randomBytes(32);
  const publicKey = crypto.createHash('sha256').update(secretKey).digest('hex');
  return { secretKey, publicKey };
}

export function createCryptCell(id: string = 'crypt', keypair?: { secretKey: Buffer; publicKey: string }): CryptCell {
  const kp = keypair ?? generateKeypair();
  return {
    id,
    secretKey: kp.secretKey,
    publicKey: kp.publicKey,
    witnesses: [],
    tickCount: 0
  };
}

function hashWitness(prevHash: string, op: string, data: string, timestamp: number): string {
  return crypto.createHash('sha256').update(`${prevHash}|${op}|${data}|${timestamp}`).digest('hex');
}

function signWitness(cell: CryptCell, hash: string): string {
  return crypto.createHmac('sha256', cell.secretKey).update(hash).digest('hex');
}

export function witness(cell: CryptCell, op: Witness['op'], data: string): Witness {
  const prevHash = cell.witnesses.length === 0
    ? '0'.repeat(64)
    : cell.witnesses[cell.witnesses.length - 1].hash;
  const timestamp = Date.now();
  const hash = hashWitness(prevHash, op, data, timestamp);
  const signature = signWitness(cell, hash);
  const w: Witness = {
    cellId: cell.id,
    op,
    data,
    timestamp,
    prevHash,
    hash,
    signature
  };
  cell.witnesses.push(w);
  cell.tickCount++;
  return w;
}

export function verifyChain(cell: CryptCell): { valid: boolean; brokenAt: number | null } {
  let prevHash = '0'.repeat(64);
  for (let i = 0; i < cell.witnesses.length; i++) {
    const w = cell.witnesses[i];
    if (w.prevHash !== prevHash) return { valid: false, brokenAt: i };
    const expectedHash = hashWitness(prevHash, w.op, w.data, w.timestamp);
    if (w.hash !== expectedHash) return { valid: false, brokenAt: i };
    const expectedSig = signWitness(cell, w.hash);
    if (w.signature !== expectedSig) return { valid: false, brokenAt: i };
    prevHash = w.hash;
  }
  return { valid: true, brokenAt: null };
}

export function detectTamper(cell: CryptCell): Witness | null {
  for (let i = 0; i < cell.witnesses.length; i++) {
    const w = cell.witnesses[i];
    const expectedSig = signWitness(cell, w.hash);
    if (w.signature !== expectedSig) return w;
    if (i > 0 && w.prevHash !== cell.witnesses[i - 1].hash) return w;
  }
  return null;
}

export function rootHash(cell: CryptCell): string {
  return cell.witnesses.length === 0 ? '0'.repeat(64) : cell.witnesses[cell.witnesses.length - 1].hash;
}

export function witnessAt(cell: CryptCell, index: number): Witness | null {
  return cell.witnesses[index] ?? null;
}

export function countByOp(cell: CryptCell, op: Witness['op']): number {
  return cell.witnesses.filter(w => w.op === op).length;
}

export function witnessesBetween(cell: CryptCell, startTime: number, endTime: number): Witness[] {
  return cell.witnesses.filter(w => w.timestamp >= startTime && w.timestamp <= endTime);
}

export function forget(cell: CryptCell, n: number): Witness[] {
  return cell.witnesses.splice(0, n);
}

export function replay(cell: CryptCell): Witness[] {
  return [...cell.witnesses];
}
