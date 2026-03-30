#!/bin/bash

# Sentry Extension Build Script
# Packages the extension for distribution

echo "🔨 Building Sentry Extension..."

# Clean previous builds
rm -f sentry-extension.zip
rm -f sentry-extension.crx

# Create package (excluding unnecessary files)
zip -r sentry-extension.zip \
  manifest.json \
  src/ \
  docs/ \
  README.md \
  -x "*.DS_Store" \
  -x "*.log" \
  -x ".git/*" \
  -x "*.md" \
  -x "docs/*"

echo "✅ Build complete: sentry-extension.zip"
echo ""
echo "📦 Package contents:"
unzip -l sentry-extension.zip | tail -10

echo ""
echo "🚀 Next steps:"
echo "1. Update manifest.json with your OAuth Client ID"
echo "2. Load unpacked in chrome://extensions/"
echo "3. Or upload sentry-extension.zip to Chrome Web Store"
