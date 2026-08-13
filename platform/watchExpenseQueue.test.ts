import type { QuickEntryCommand } from '../domain/quickEntry';
import { quickEntryCommandKey } from '../domain/quickEntry';
import { WatchExpenseQueue, type WatchExpenseTransport } from './watchExpenseQueue';

const command = (id: string): QuickEntryCommand => ({
  version: 1, source: 'watch', id, timestamp: '2026-08-11T00:00:00.000Z',
  amount: 500, category: 'Food', note: '', date: { y: 2026, m: 7, day: 11 },
});

describe('WatchExpenseQueue', () => {
  it('keeps a command queued until the transport acknowledges its exact stable identity', async () => {
    const queue = new WatchExpenseQueue();
    queue.enqueue(command('watch-command-1'));
    const transport: WatchExpenseTransport = { send: jest.fn().mockResolvedValue([]) };

    await expect(queue.deliver(transport)).resolves.toEqual([]);
    expect(queue.entries()).toEqual([command('watch-command-1')]);

    (transport.send as jest.Mock).mockResolvedValue([quickEntryCommandKey(command('watch-command-1'))]);
    await expect(queue.deliver(transport)).resolves.toEqual(['watch:watch-command-1']);
    expect(queue.entries()).toEqual([]);
  });

  it('does not let an unrelated acknowledgement remove another queued command', async () => {
    const queue = new WatchExpenseQueue();
    queue.enqueue(command('one'));
    queue.enqueue(command('two'));
    const transport: WatchExpenseTransport = { send: jest.fn().mockResolvedValue(['watch:not-sent', 'watch:two']) };

    await expect(queue.deliver(transport)).resolves.toEqual(['watch:two']);
    expect(queue.entries()).toEqual([command('one')]);
  });

  it('rejects non-Watch and malformed commands before they can enter the retry queue', () => {
    const queue = new WatchExpenseQueue();
    expect(() => queue.enqueue({ ...command('widget-command'), source: 'widget' })).toThrow('Watch queue');
    expect(() => queue.enqueue({ ...command('bad-command'), amount: 0 })).toThrow('Watch queue');
  });
});
