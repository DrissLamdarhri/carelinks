#!/bin/bash
# CareLink Mobile App - Quick Build Script for Testing

set -e

echo "🚀 CareLink Mobile App - Quick Build Script"
echo "============================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo -e "\n${YELLOW}✓ Checking prerequisites...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js not found. Please install Node.js 16+${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js found: $(node --version)${NC}"

if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}Installing pnpm...${NC}"
    npm install -g pnpm
fi
echo -e "${GREEN}✓ pnpm found: $(pnpm --version)${NC}"

if ! command -v java &> /dev/null; then
    echo -e "${YELLOW}⚠ Java not found. Building via EAS Cloud instead...${NC}"
    USE_EAS=true
else
    echo -e "${GREEN}✓ Java found: $(java -version 2>&1 | head -1)${NC}"
    USE_EAS=false
fi

# Install dependencies
echo -e "\n${YELLOW}Installing dependencies...${NC}"
pnpm install

# Option: Build locally or via EAS
if [ "$USE_EAS" = true ]; then
    echo -e "\n${YELLOW}📱 Building via EAS Cloud (no Android SDK needed)${NC}"
    
    if ! command -v eas &> /dev/null; then
        echo -e "${YELLOW}Installing EAS CLI...${NC}"
        npm install -g eas-cli
    fi
    
    echo -e "\n${YELLOW}Logging in to Expo...${NC}"
    eas login
    
    echo -e "\n${YELLOW}Starting EAS build...${NC}"
    eas build --platform android --profile preview
    
    echo -e "\n${GREEN}✓ Build submitted to EAS!${NC}"
    echo -e "${YELLOW}📍 Check your email or visit: https://expo.dev/dashboard${NC}"
else
    echo -e "\n${YELLOW}📱 Building locally with Gradle...${NC}"
    
    # Check Android SDK
    if [ -z "$ANDROID_HOME" ]; then
        ANDROID_HOME="$HOME/Android/Sdk"
        export ANDROID_HOME
    fi
    
    if [ ! -d "$ANDROID_HOME" ]; then
        echo -e "${RED}✗ Android SDK not found at $ANDROID_HOME${NC}"
        echo -e "${YELLOW}Please install Android SDK or use EAS build${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Android SDK found at $ANDROID_HOME${NC}"
    
    export PATH=$PATH:$ANDROID_HOME/tools:$ANDROID_HOME/tools/bin:$ANDROID_HOME/platform-tools
    
    echo -e "\n${YELLOW}Prebuilding Android project...${NC}"
    npx expo prebuild --platform android --clean
    
    echo -e "\n${YELLOW}Building release APK...${NC}"
    cd android
    ./gradlew assembleRelease
    cd ..
    
    APK_PATH="android/app/build/outputs/apk/release/app-release.apk"
    
    if [ -f "$APK_PATH" ]; then
        echo -e "\n${GREEN}✓ APK built successfully!${NC}"
        echo -e "${GREEN}📍 Location: $APK_PATH${NC}"
        
        if command -v adb &> /dev/null; then
            echo -e "\n${YELLOW}Install on connected device? (y/n)${NC}"
            read -r response
            if [ "$response" = "y" ]; then
                adb install -r "$APK_PATH"
                echo -e "${GREEN}✓ App installed on device!${NC}"
            fi
        fi
    else
        echo -e "${RED}✗ APK not found at $APK_PATH${NC}"
        exit 1
    fi
fi

echo -e "\n${GREEN}✓ Done!${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo -e "  1. Transfer APK to your device (if building locally)"
echo -e "  2. Install the app"
echo -e "  3. Grant permissions on first launch"
echo -e "  4. Test the booking and tracking flows"
echo -e "\nSee BUILD_GUIDE.md for detailed troubleshooting."
