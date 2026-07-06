#!/bin/bash

echo "============================================"
echo "CareLink APK Build - Automated"
echo "============================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Install deps
echo -e "${YELLOW}[1/5]${NC} Installing dependencies..."
pnpm install --frozen-lockfile || exit 1
echo -e "${GREEN}✓ Dependencies installed${NC}\n"

# Step 2: Prebuild
echo -e "${YELLOW}[2/5]${NC} Generating Android project..."
npx expo prebuild --platform android --clean || exit 1
echo -e "${GREEN}✓ Android project ready${NC}\n"

# Step 3: Build
echo -e "${YELLOW}[3/5]${NC} Building APK (this takes ~5-15 minutes)..."
cd android

# Try with retry for network timeout
MAX_RETRIES=3
RETRY=0

while [ $RETRY -lt $MAX_RETRIES ]; do
    echo "Attempt $((RETRY+1)) of $MAX_RETRIES..."
    ./gradlew assembleRelease && break
    RETRY=$((RETRY+1))
    if [ $RETRY -lt $MAX_RETRIES ]; then
        echo -e "${YELLOW}Build failed, retrying in 10 seconds...${NC}"
        sleep 10
    fi
done

if [ $RETRY -eq $MAX_RETRIES ]; then
    echo -e "${RED}✗ Build failed after $MAX_RETRIES attempts${NC}"
    echo "Network timeout issues detected."
    echo ""
    echo "Alternative: Use EAS cloud build:"
    echo "  npm install -g eas-cli"
    echo "  eas login"
    echo "  cd .. && eas build --platform android --profile preview"
    exit 1
fi

echo -e "${GREEN}✓ APK built successfully${NC}\n"

# Step 4: Check output
echo -e "${YELLOW}[4/5]${NC} Verifying APK..."
APK_PATH="./app/build/outputs/apk/release/app-release.apk"
if [ -f "$APK_PATH" ]; then
    APK_SIZE=$(ls -lh "$APK_PATH" | awk '{print $5}')
    echo -e "${GREEN}✓ APK ready: $APK_PATH${NC}"
    echo -e "  Size: $APK_SIZE"
else
    echo -e "${RED}✗ APK not found at $APK_PATH${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}✓ BUILD COMPLETE!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "APK Location: $APK_PATH"
echo ""
echo "Next steps:"
echo "1. Connect Android phone via USB"
echo "2. Enable USB debugging (Settings → Developer Options)"
echo "3. Run: adb install -r $APK_PATH"
echo "4. Or: Copy APK to phone and tap to install"
echo ""

