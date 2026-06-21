// Wrapper to expose the MapSectionNative component where BookingMap expects it\n// The actual implementation lives in src/components/map/MapSectionNative.tsx\n\n// CommonJS-style wrapper to avoid ESM/CJS ambiguity with Metro require
// It loads the real implementation from src and exports default or module directly.
try {
  const _mod = require('../../src/components/map/MapSectionNative');
  // prefer default export if present
  module.exports = _mod && (_mod.default || _mod);
} catch (e) {
  // If require fails, export a placeholder to avoid crashing the bundler at parse time
  // The consuming code should handle undefined gracefully.
  module.exports = undefined;
}
