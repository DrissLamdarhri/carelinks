const path = require("path");
const fs = require("fs");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (!moduleName) return defaultResolveRequest ? defaultResolveRequest(context, moduleName, platform) : context.resolveRequest(context, moduleName, platform);

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
