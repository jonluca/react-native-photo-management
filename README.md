# react-native-photo-management

`react-native-photo-management` is an Expo module for scanning the device photo library across projects.

It exposes:

- iOS-native batch asset metadata lookup via PhotoKit
- Android and iOS on-device image classification
- Cross-platform food detection built on Apple Vision and ML Kit labels
- Android JS fallback batching built on `expo-media-library`
- A streaming `scanPhotoLibrary()` helper so app code owns persistence
- Bulk album creation/update helpers that skip missing assets
- Bulk asset delete helpers with missing-asset tolerance
- A config plugin that wires `expo-media-library` permissions from a single plugin entry

## Install

```bash
npx expo install react-native-photo-management expo-media-library expo-device
```

Add the plugin to your app config:

```json
{
  "expo": {
    "plugins": ["react-native-photo-management"]
  }
}
```

Optional plugin configuration:

```json
{
  "expo": {
    "plugins": [
      [
        "react-native-photo-management",
        {
          "photosPermission": "Allow $(PRODUCT_NAME) to access your photos to scan and organize your library.",
          "isAccessMediaLocationEnabled": true
        }
      ]
    ]
  }
}
```

## Platform Support

| Platform | `getAssetInfoBatch`                  | `classifyImageBatch` | `detectFoodInImageBatch` | `createAlbumWithAssets` / `deleteAssetsBatch` | `scanPhotoLibrary`                |
| -------- | ------------------------------------ | -------------------- | ------------------------ | --------------------------------------------- | --------------------------------- |
| iOS      | Native batch bridge                  | Apple Vision         | Supported                | Supported                                     | Native batch metadata + streaming |
| Android  | JS fallback via `expo-media-library` | ML Kit               | Supported                | Supported                                     | JS fallback + streaming           |
| Web      | Unsupported                          | Unsupported          | Unsupported              | Unsupported                                   | Unsupported                       |

## API

### `isNativeBatchAssetInfoAvailable()`

Returns `true` when the iOS native batch bridge is linked and available.

### `isFoodDetectionAvailable()`

Returns `true` on iOS and Android when the native image classifier is linked.

### `requestPhotoLibraryPermission()`

Requests photo-library access and resolves to `true` when access is granted.

### `hasPhotoLibraryPermission()`

Checks current photo-library access.

### `countPhotoLibraryAssets(options?)`

Counts assets for the requested media types. Defaults to photos and videos.

### `getAssetInfoBatch(assetIds)`

Loads `BatchAssetInfo[]` for a set of asset IDs.

```ts
type BatchAssetInfo = {
  id: string;
  uri: string;
  creationTime: number;
  modificationTime: number;
  width: number;
  height: number;
  mediaType: "photo" | "video" | "audio" | "unknown";
  duration: number;
  location: {
    latitude: number;
    longitude: number;
    altitude?: number | null;
    speed?: number | null;
    heading?: number | null;
  } | null;
};
```

On Android, unreadable or deleted assets are skipped.

### `classifyImageBatch(assetIds, options?)`

Runs on-device image labeling and returns platform-native labels.

```ts
type ClassificationResult = {
  assetId: string;
  labels: Array<{ label: string; confidence: number }>;
  error?: string;
};
```

On Android, non-photo assets are returned with an `error` instead of crashing the batch.

### `detectFoodInImageBatch(assetIds, options?)`

Runs on-device classification and filters for food-related labels.

```ts
type FoodDetectionResult = {
  assetId: string;
  containsFood: boolean;
  foodConfidence: number;
  foodLabels: Array<{ label: string; confidence: number }>;
  labels: Array<{ label: string; confidence: number }>;
  error?: string;
};
```

On web, this throws an `UnsupportedPlatformError`.

Label vocabularies differ between Apple Vision and ML Kit, so the exact label text may not match across platforms even though the API contract does.

### `createAlbumWithAssets(albumName, assetIds, options?)`

Creates an album when missing or appends to an existing one. Missing or unreadable assets are skipped.

```ts
type CreateAlbumWithAssetsResult = {
  success: boolean;
  albumId?: string;
  albumName: string;
  assetCount: number;
  created: boolean;
  skippedAssets: number;
  missingAssetIds: string[];
  error?: string;
};
```

### `deleteAssetsBatch(assetIds)`

Deletes all readable assets in a batch and reports any missing ones without failing the whole request.

```ts
type DeleteAssetsBatchResult = {
  requestedCount: number;
  deletedCount: number;
  skippedAssets: number;
  missingAssetIds: string[];
  success: boolean;
  error?: string;
};
```

### `scanPhotoLibrary(options)`

Streams library assets in batches and reports progress after each page.

```ts
const progress = await scanPhotoLibrary({
  onBatch: async (assets) => {
    // Persist or process assets here
  },
  onProgress: (value) => {
    console.log(value.processedAssets, value.totalAssets);
  },
});
```

`scanPhotoLibrary()` returns:

```ts
type ScanPhotoLibraryProgress = {
  totalAssets: number;
  processedAssets: number;
  emittedAssets: number;
  assetsWithLocation: number;
  skippedAssets: number;
  isComplete: boolean;
  elapsedMs: number;
  assetsPerSecond: number;
  etaMs: number | null;
  strategy: "ios-native-batch" | "js-fallback";
  deviceTier: "low" | "medium" | "high";
};
```

## Example

The repo includes an Expo example app in `example/App.tsx` that exercises:

- permission checks
- asset counting
- streaming scan progress
- batch metadata lookup
- cross-platform image classification and food detection
- bulk album creation from sampled assets

Run it with:

```bash
npm run example:start
npm run example:ios
npm run example:android
```

## Automated npm Publishing

This repo is configured for npm trusted publishing from GitHub Actions in `.github/workflows/publish.yml`.

Before the workflow can publish, configure the npm package once on npmjs.com:

1. Open the package settings for `react-native-photo-management`.
2. In `Trusted Publisher`, choose `GitHub Actions`.
3. Set `Organization or user` to `jonluca`.
4. Set `Repository` to `react-native-photo-management`.
5. Set `Workflow filename` to `publish.yml`.

npm trusted publishing uses GitHub OIDC, so no `NPM_TOKEN` secret is required. Because this repo is public and the package is public, npm will automatically attach provenance attestations when the workflow publishes.

After the first successful publish, npm recommends tightening package settings to `Require two-factor authentication and disallow tokens` so only trusted publishing remains available.

## Release Flow

1. Update `package.json` and `package-lock.json` to the next version.
2. Commit the release.
3. Push a matching Git tag such as `v0.1.1`.

The workflow publishes only when the pushed tag matches the `package.json` version exactly.

## Manual Validation

Validate the package contents before publishing:

```bash
npm run build
npm run typecheck
npm run lint
npm test
npm pack
```

Then publish:

```bash
npm publish --access public
```

Manual local publishing is still available, but the intended release path is GitHub Actions trusted publishing via signed provenance.
