# Editing Practices

## Import Statements

When adding new imports to a file, always include the code that uses those imports in the same edit operation. The editor automatically removes unused imports on save, so if you add an import in one edit and the usage in a separate edit, the import will be removed before you can use it.

**Do this:**

```typescript
// Single edit that adds both import and usage
import { calculateBAB } from "./FeatService.js";

const bab = calculateBAB(level);
```

**Don't do this:**

```typescript
// Edit 1: Add import (will be removed on save as unused)
import { calculateBAB } from "./FeatService.js";

// Edit 2: Add usage (import is now gone, causing errors)
const bab = calculateBAB(level);
```
