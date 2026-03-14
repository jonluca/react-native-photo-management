# react-native-photo-management

`react-native-photo-management` is an Expo module for scanning the device photo library across projects.

It exposes:

- iOS-native batch asset metadata lookup via PhotoKit
- iOS-native food detection via Apple Vision
- Android JS fallback batching built on `expo-media-library`
- A streaming `scanPhotoLibrary()` helper so app code owns persistence
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

| Platform | `getAssetInfoBatch`                  | `detectFoodInImageBatch` | `scanPhotoLibrary`                |
| -------- | ------------------------------------ | ------------------------ | --------------------------------- |
| iOS      | Native batch bridge                  | Apple Vision             | Native batch metadata + streaming |
| Android  | JS fallback via `expo-media-library` | Unsupported              | JS fallback + streaming           |
| Web      | Unsupported                          | Unsupported              | Unsupported                       |

## API

### `isNativeBatchAssetInfoAvailable()`

Returns `true` when the iOS native batch bridge is linked and available.

### `isFoodDetectionAvailable()`

Returns `true` only on iOS when Apple Vision-backed food detection is available.

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

### `detectFoodInImageBatch(assetIds, options?)`

Runs Apple Vision classification on iOS and returns `FoodDetectionResult[]`.

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

On Android and web, this throws an `UnsupportedPlatformError`.

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
- iOS food detection on sampled photos

Run it with:

```bash
npm run example:start
npm run example:ios
npm run example:android
```

## Publish

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
