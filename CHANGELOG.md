# Changelog

## Unpublished

### 🎉 New features

- Added a standalone Expo module package for reusable photo-library access.
- Added iOS-native PhotoKit batch asset metadata lookup.
- Added iOS-native Apple Vision food detection for sampled assets.
- Added Android JS fallback batch metadata lookup.
- Added Android on-device image classification and food detection parity.
- Added streaming `scanPhotoLibrary()` progress and batch callbacks.
- Added an Expo config plugin that wraps `expo-media-library` permission setup.
- Added an Expo example app for local smoke testing.
- Added GitHub Actions trusted publishing for automatic signed npm releases on version tags.
- Added bulk image classification, album creation/update, and delete helpers.

### 🐛 Bug fixes

- Removed the package's last direct runtime dependency by inlining the bounded concurrency helper.
- Ignored local Playwright browser artifacts in the repo.
