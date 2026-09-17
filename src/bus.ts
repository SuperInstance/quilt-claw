/**
 * MessageBus — the bus is a cell.
 *
 * The message bus in autoclaw is a SQLite pub/sub table. In quilt-claw,
 * it's a `value` cell that holds pending task IDs.
 *
 * Cells LINK to the bus to subscribe. When a task arrives at the bus,
 * the bus notifies subscribed cells. When a cell claims a task, it
 * BINDs the bus to update the pending state.
 */

import type { Task } from './types.js';

export class MessageBus {
  private tasks = new Map<string, Task>();
  private claimed = new Set<string>();
  private completed = new Set<string>();
  private subscribers = new Map<string, Set<(task: Task) => void>>();

  /**
   * Submit a task to the bus.
   * Returns the task id. The bus notifies all subscribers matching the task kind.
   */
  submit(task: Task): string {
    this.tasks.set(task.id, task);
    this.notifySubscribers(task);
    return task.id;
  }

  /**
   * Subscribe to a task kind. Callback fires when a task of that kind arrives.
   * Returns an unsubscribe function.
   */
  subscribe(kind: string, callback: (task: Task) => void): () => void {
    if (!this.subscribers.has(kind)) {
      this.subscribers.set(kind, new Set());
    }
    this.subscribers.get(kind)!.add(callback);
    return () => {
      this.subscribers.get(kind)?.delete(callback);
    };
  }

  /**
   * Claim a task (mark it as in-progress by a cell).
   * Returns true if claimed, false if already claimed or completed.
   */
  claim(taskId: string): boolean {
    if (this.claimed.has(taskId) || this.completed.has(taskId)) {
      return false;
    }
    this.claimed.add(taskId);
    return true;
  }

  /**
   * Complete a task (mark it as done).
   */
  complete(taskId: string): void {
    this.claimed.delete(taskId);
    this.completed.add(taskId);
  }

  /**
   * Get the pending tasks of a kind (not yet claimed).
   */
  pending(kind: string): Task[] {
    return Array.from(this.tasks.values()).filter(
      (t) => t.kind === kind && !this.claimed.has(t.id) && !this.completed.has(t.id)
    );
  }

  /**
   * Get a task by id.
   */
  get(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Dump the bus state for debugging.
   */
  dump(): {
    pending: number;
    claimed: number;
    completed: number;
    subscribers: Record<string, number>;
  } {
    const subs: Record<string, number> = {};
    for (const [kind, set] of this.subscribers) {
      subs[kind] = set.size;
    }
    return {
      pending: this.tasks.size - this.claimed.size - this.completed.size,
      claimed: this.claimed.size,
      completed: this.completed.size,
      subscribers: subs,
    };
  }

  private notifySubscribers(task: Task): void {
    const subs = this.subscribers.get(task.kind);
    if (!subs) return;
    for (const cb of subs) {
      try {
        cb(task);
      } catch (err) {
        console.error(`subscriber error for ${task.kind}:`, err);
      }
    }
  }
}
