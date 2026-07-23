// Shim for @expo/metro-runtime/error-overlay
// Minimal fallback used when the package doesn't expose the subpath via "exports".
// This simply returns the component unchanged. In dev you can replace with a richer overlay.

function withErrorOverlay(Component) {
  return Component;
}

module.exports = { withErrorOverlay };
