# Household backup and restore

Kaji writes three different files. They are not interchangeable, and the
difference is the whole point of the zero-lock-in promise.

| File | Module | Purpose | Contains |
| --- | --- | --- | --- |
| `kaji-export.csv` | `domain/zaim.ts` | Portable, lossy interchange | One row per transaction, readable by other apps |
| `kaji-household-backup.json` | `domain/householdBackup.ts` | Full-fidelity, app-private restore | The whole household plus sync metadata |
| Recovery pack | `domain/recoveryPack.ts` | Encrypted household key custody | Pairing state and household key material |

## Portable CSV is deliberately lossy

The CSV exists so the user can leave. It carries dates, types, amounts,
categories, and notes: what another budgeting app can actually read. It drops
recurrence rules, budgets, tombstones, attribution, and every version vector,
and re-importing it produces new transaction identities. It is never a backup
and must not be described as one in UI copy.

## The full-fidelity backup

`createHouseholdBackup` serializes a versioned JSON envelope:

```
{ format: "kaji.household-backup", version, householdId, createdAt, payload }
```

The payload carries the replicated household (`entries`, `recurrenceRules`,
`categories`, `budgets`, `currency`) and the sync metadata a replica needs to
keep converging after a restore: version vectors, the applied-operation replay
fence, tombstones, attribution, and history. `config` and `recurrence` sync
states are present once the household has replicated them and are omitted
otherwise, so a household that has never paired still produces a valid file.

Because the replay fence and tombstones survive, a restored replica is not a
fresh one: an operation already applied before the backup is a no-op if it
arrives again, and a deleted transaction stays deleted rather than being
resurrected by a delayed add.

### What a backup never contains

Device-local preferences are excluded, and the exclusion is a contract, not an
accident of the payload shape: see `HOUSEHOLD_BACKUP_EXCLUDED_FIELDS`. Restoring
a household onto a phone must not repaint that phone's theme, motion setting,
calendar view, summary granularity, budget mode, or category order. Unknown keys
in a hand-edited file are dropped during staging rather than carried in.

A backup also carries no household key, passphrase, or pairing invitation. Key
custody belongs to the encrypted recovery pack, which is a separate artifact
with its own passphrase and device-authentication gate.

## Restore is staged, previewed, and reversible

`readHouseholdBackup` parses and fully validates before anything is written.
It rejects:

- a file that is not JSON, or is not tagged `kaji.household-backup`
  (`invalid-backup`);
- a file written by a newer app (`unsupported-version`) — dropping fields we
  cannot read would silently discard household data;
- any record that fails the same validation `load()` applies
  (`invalid-backup`);
- a file whose header, sub-states, or the caller's expected household disagree
  about which household it is (`wrong-household`).

Legacy records are read, not rejected. A household saved before transactions
carried timestamps restores with the same deterministic inferred timestamp the
store's loader assigns, and a one-time entry is pinned to `repeat: 'never'` so
an old materialized repeat cannot come back as an infinite series.

`previewHouseholdBackup` returns the counts a confirmation dialog needs
(entries, rules, categories, budgets, tombstones, attributed transactions,
history entries, applied operations) and writes nothing.

`restoreHouseholdBackup` reads the current household as a checkpoint, derives
the destination household identity from that checkpoint, and refuses a foreign
file. Callers must first show `previewHouseholdBackup` and then pass the
explicit confirmation boundary `{ confirm: true }` to commit. If the write fails, the checkpoint is written back and the call fails
with `restore-failed`, so a failed restore never leaves half a household behind.
A restore that succeeds returns a `rollback()` that puts the prior household
back, for the user who restored the wrong file.
