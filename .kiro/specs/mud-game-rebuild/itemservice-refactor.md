# ItemService Refactoring Task

## Goal

Consolidate duplicated item-finding logic in ItemService.ts to reduce ~150 lines of duplication and ensure consistent matching behavior across room inventory, player inventory, and container inventory.

## Current State

ItemService.ts (~1400 lines) has three nearly identical functions:

- `findItemInRoom()` - searches room inventory
- `findItemInPlayerInventory()` - searches player inventory
- `findItemInContainer()` - searches container inventory

Each implements the same matching algorithm:

1. Exact match on name or pluralName
2. Prefix match on name or pluralName
3. Word match (any word in name starts with search term)

## Proposed Solution

### Step 1: Create generic item matcher

Create a new function in `ItemService.utils.ts`:

```typescript
type ItemWithInventory<T> = {
  item: { name: string; pluralName?: string | null };
  inventoryRecord: T;
};

type MatchResult<T> = {
  item: Item;
  inventoryRecord: T;
  matchedPlural: boolean;
} | null;

function findItemByName<T>(
  items: ItemWithInventory<T>[],
  searchName: string,
  toItem: (raw: ItemWithInventory<T>["item"]) => Item,
): MatchResult<T>;
```

### Step 2: Refactor each find function

Replace the duplicated matching logic with calls to the generic matcher:

```typescript
async function findItemInRoom(roomId: string, itemName: string) {
  const roomItems = await db.select()...
  return findItemByName(
    roomItems.map(r => ({ item: r.items, inventoryRecord: r.room_inventory })),
    itemName,
    toItem
  );
}
```

### Step 3: Update return types

The `ItemFindResult` type in utils already has the right shape. Ensure the generic matcher returns compatible data.

## Files to Modify

- `src/services/ItemService.utils.ts` - Add generic matcher
- `src/services/ItemService.ts` - Refactor three find functions

## Testing Strategy

- Existing unit tests in `tests/unit/item.test.ts` should continue to pass
- Existing property tests in `tests/property/item.property.test.ts` should continue to pass
- No new tests needed - this is a pure refactor with no behavior change

## Progress Tracking

### Phase 1: Generic Matcher (COMPLETE)

- [x] Step 1: Create generic `findItemByName` in utils
- [x] Step 2a: Refactor `findItemInRoom` to use generic matcher
- [x] Step 2b: Refactor `findItemInPlayerInventory` to use generic matcher
- [x] Step 2c: Refactor `findItemInContainer` to use generic matcher
- [x] Step 3: Run tests to verify no regressions (195 tests pass)
- [x] Step 4: Run build to verify no type errors
- [x] Cleanup: `matchesPlural` is still used by the generic matcher in utils, no dead code

### Phase 2: Split into Directory Structure (COMPLETE)

Target structure:

```
src/services/items/
├── index.ts              # Re-exports everything (backward compatible)
├── finders.ts            # All find* functions (shared utilities)
├── transfer.ts           # get, drop, give, put (moving items between locations)
├── equipment.ts          # equip, unequip, getEquipmentList
├── containers.ts         # open, close, examineContainer
└── examine.ts            # examineItem, getInventory
```

Progress:

- [x] Create `src/services/items/` directory structure
- [x] Create `finders.ts` with shared find functions
- [x] Create `transfer.ts` with getItem, dropItem, giveItem, putItemInContainer, getItemFromContainer
- [x] Create `equipment.ts` with equip/unequip functions and slot helpers
- [x] Create `containers.ts` with open/close/examineContainer
- [x] Create `examine.ts` with examineItem, getInventory
- [x] Create `index.ts` that re-exports all public functions
- [x] Update imports in consumers (command handlers, tests)
- [x] Delete old `ItemService.ts`
- [x] Run tests to verify no regressions (195 tests pass)
- [x] Run build to verify no type errors

## Refactoring Complete

Both phases complete. ItemService has been:

1. Consolidated with a generic item matcher to reduce duplication
2. Split into a modular directory structure for maintainability

Files created:

- `src/services/items/finders.ts` - Item/container finding utilities
- `src/services/items/transfer.ts` - get, drop, give, put operations
- `src/services/items/equipment.ts` - equip, unequip, equipment list
- `src/services/items/containers.ts` - open, close, examine containers
- `src/services/items/examine.ts` - examine items, get inventory
- `src/services/items/index.ts` - Re-exports for backward compatibility

Shared utilities remain in `src/services/ItemService.utils.ts`.
