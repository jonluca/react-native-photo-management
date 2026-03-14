import type {
  BatchAssetInfo,
  ClassificationLabel,
  FoodDetectionResult,
  ScanPhotoLibraryProgress,
} from "./ReactNativePhotoManagement.types";

type ClassificationResult = {
  assetId: string;
  labels: ClassificationLabel[];
  error?: string;
};

export const DEFAULT_FOOD_IDENTIFIERS = new Set([
  "food",
  "dish",
  "meal",
  "cuisine",
  "snack",
  "breakfast",
  "lunch",
  "dinner",
  "brunch",
  "appetizer",
  "dessert",
  "salad",
  "soup",
  "sandwich",
  "pizza",
  "pasta",
  "sushi",
  "burger",
  "steak",
  "chicken",
  "fish",
  "seafood",
  "meat",
  "vegetable",
  "fruit",
  "bread",
  "cake",
  "pie",
  "cookie",
  "ice_cream",
  "chocolate",
  "candy",
  "beverage",
  "coffee",
  "tea",
  "wine",
  "beer",
  "cocktail",
  "juice",
  "smoothie",
  "menu",
  "plate",
  "bowl",
  "restaurant",
  "cafe",
  "dining",
  "table_setting",
  "cutlery",
]);

export function createUnsupportedPlatformError(
  methodName: string,
  platform: string,
): Error {
  const error = new Error(`${methodName} is not supported on ${platform}.`);
  error.name = "UnsupportedPlatformError";
  return error;
}

export function hasUsableLocation(
  location: BatchAssetInfo["location"],
): boolean {
  return Boolean(
    location && location.latitude !== 0 && location.longitude !== 0,
  );
}

export function processForFoodDetection(
  result: ClassificationResult,
  foodConfidenceThreshold: number,
  foodKeywords: Set<string>,
): FoodDetectionResult {
  const foodLabels = result.labels.filter((label) => {
    const normalizedLabel = label.label.trim().toLowerCase();
    return (
      foodKeywords.has(normalizedLabel) &&
      label.confidence >= foodConfidenceThreshold
    );
  });

  return {
    assetId: result.assetId,
    containsFood: foodLabels.length > 0,
    foodConfidence:
      foodLabels.length > 0
        ? Math.max(...foodLabels.map((label) => label.confidence))
        : 0,
    foodLabels,
    labels: result.labels,
    error: result.error,
  };
}

export function summarizeCollectedAssets(
  assets: (BatchAssetInfo | null | undefined)[],
): {
  assets: BatchAssetInfo[];
  skippedAssets: number;
  assetsWithLocation: number;
} {
  let skippedAssets = 0;
  let assetsWithLocation = 0;
  const collectedAssets: BatchAssetInfo[] = [];

  for (const asset of assets) {
    if (!asset) {
      skippedAssets += 1;
      continue;
    }

    collectedAssets.push(asset);
    if (hasUsableLocation(asset.location)) {
      assetsWithLocation += 1;
    }
  }

  return {
    assets: collectedAssets,
    skippedAssets,
    assetsWithLocation,
  };
}

export function updateScanProgressMetrics(
  progress: ScanPhotoLibraryProgress,
  startedAt: number,
  minimumSecondsForEstimate = 2,
): ScanPhotoLibraryProgress {
  const elapsedMs = Date.now() - startedAt;
  const elapsedSeconds = elapsedMs / 1000;
  const remainingAssets = Math.max(
    progress.totalAssets - progress.processedAssets,
    0,
  );

  let assetsPerSecond = 0;
  let etaMs: number | null = null;

  if (remainingAssets === 0) {
    assetsPerSecond =
      elapsedSeconds > 0
        ? Math.round(progress.processedAssets / elapsedSeconds)
        : 0;
    etaMs = 0;
  } else if (
    elapsedSeconds >= minimumSecondsForEstimate &&
    progress.processedAssets > 0
  ) {
    assetsPerSecond = Math.round(progress.processedAssets / elapsedSeconds);
    etaMs =
      assetsPerSecond > 0 ? (remainingAssets / assetsPerSecond) * 1000 : null;
  }

  return {
    ...progress,
    elapsedMs,
    assetsPerSecond,
    etaMs,
  };
}
