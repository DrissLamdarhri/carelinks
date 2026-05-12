const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

// Watch the entire workspace for changes
config.watchFolders = [workspaceRoot];

// Use hierarchical lookup: check mobile/node_modules first, then workspace root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Pin core React packages to mobile/node_modules to avoid duplicate React instances
config.resolver.extraNodeModules = {
  react: path.resolve(projectRoot, "node_modules/react"),
  "react-native": path.resolve(projectRoot, "node_modules/react-native"),
  "@expo/metro-runtime": path.resolve(
    workspaceRoot,
    "node_modules/@expo/metro-runtime"
  ),
};

// Enable hierarchical lookup to naturally find other packages
config.resolver.disableHierarchicalLookup = false;

module.exports = withNativeWind(config, { input: "./global.css" });
