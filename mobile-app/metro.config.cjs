const path = require("path");
const fs = require("fs");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Windows file watcher fix: disable watchman completely
if (process.platform === "win32") {
  config.watchman = false;
  config.resolver.useWatchman = false;
  config.fileMapCacheDir = null;
  config.resetCache = true;
}

// Disable watch mode entirely
config.reporter = {
  update: () => {},
};

config.maxWorkers = 2;

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (!moduleName) return defaultResolveRequest ? defaultResolveRequest(context, moduleName, platform) : context.resolveRequest(context, moduleName, platform);

  // ── Force a SINGLE copy of React / React Native across the pnpm monorepo ──
  // Multiple react copies (root web app 18.x + a transitive 19.2.x alongside the
  // app's 19.1.0) cause "Invalid hook call" / "useState of null". Resolve every
  // react / react-native import from the project root so there's exactly one.
  if (
    moduleName === "react" ||
    moduleName === "react-native" ||
    moduleName.startsWith("react/") ||
    moduleName.startsWith("react-native/")
  ) {
    return context.resolveRequest(
      { ...context, originModulePath: path.join(__dirname, "index.js") },
      moduleName,
      platform
    );
  }

  if (moduleName === "expo-keep-awake") {
    return {
      type: "sourceFile",
      filePath: path.resolve(__dirname, "lib/shims/expo-keep-awake.ts"),
    };
  }

  // Support imports starting with "@/..." by mapping to ./src/...
  if (moduleName.startsWith('@/')) {
    const rel = moduleName.slice(2);
    const candidates = [
      path.resolve(__dirname, 'src', rel),
      path.resolve(__dirname, 'src', rel + '.ts'),
      path.resolve(__dirname, 'src', rel + '.tsx'),
      path.resolve(__dirname, 'src', rel + '.js'),
      path.resolve(__dirname, 'src', rel + '.jsx'),
      path.resolve(__dirname, 'src', rel, 'index.ts'),
      path.resolve(__dirname, 'src', rel, 'index.tsx'),
      path.resolve(__dirname, 'src', rel, 'index.js'),
      path.resolve(__dirname, 'src', rel, 'index.jsx'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        return { type: 'sourceFile', filePath: p };
      }
    }

    // Fallback: also try resolving to project root (some files live in /lib)
    const candidates2 = [
      path.resolve(__dirname, rel),
      path.resolve(__dirname, rel + '.ts'),
      path.resolve(__dirname, rel + '.tsx'),
      path.resolve(__dirname, rel + '.js'),
      path.resolve(__dirname, rel + '.jsx'),
      path.resolve(__dirname, rel, 'index.ts'),
      path.resolve(__dirname, rel, 'index.tsx'),
      path.resolve(__dirname, rel, 'index.js'),
      path.resolve(__dirname, rel, 'index.jsx'),
    ];
    for (const p of candidates2) {
      if (fs.existsSync(p)) {
        return { type: 'sourceFile', filePath: p };
      }
    }

    // Not found: fall through to default resolver to produce clearer message
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
