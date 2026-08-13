import type { QuickEntryCommand } from '../domain/quickEntry';
import { quickEntryCommandKey, validateQuickEntryCommand } from '../domain/quickEntry';

/** The narrow WatchConnectivity contract. The phone only acknowledges command IDs it durably accepts. */
export interface WatchExpenseTransport {
  send(commands: readonly QuickEntryCommand[]): Promise<readonly string[]>;
}

/**
 * Keeps a Watch-originated expense until the paired iPhone acknowledges its
 * stable command identity. A transport may retry the same command safely.
 */
export class WatchExpenseQueue {
  private pending = new Map<string, QuickEntryCommand>();

  enqueue(command: QuickEntryCommand): void {
    if (command.source !== 'watch' || validateQuickEntryCommand(command) !== null) {
      throw new Error('Watch queue accepts valid Watch expense commands only');
    }
    this.pending.set(quickEntryCommandKey(command), command);
  }

  entries(): readonly QuickEntryCommand[] {
    return [...this.pending.values()];
  }

  async deliver(transport: WatchExpenseTransport): Promise<readonly string[]> {
    const batch = this.entries();
    if (batch.length === 0) return [];
    const sent = new Set(batch.map(quickEntryCommandKey));
    const acknowledgements = await transport.send(batch);
    const accepted = acknowledgements.filter((id) => sent.has(id));
    for (const id of accepted) this.pending.delete(id);
    return accepted;
  }
}
