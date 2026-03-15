import type {
  BatchAssetInfo,
  ClassificationResult,
  FoodDetectionResult,
  ScanPhotoLibraryProgress,
} from "./ReactNativePhotoManagement.types";

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

export function createClassificationErrorResult(
  assetId: string,
  error: string,
): ClassificationResult {
  return {
    assetId,
    labels: [],
    error,
  };
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

export function partitionExistingAssetIds(
  assetIds: string[],
  assets: (BatchAssetInfo | null | undefined)[],
): {
  existingAssetIds: string[];
  missingAssetIds: string[];
} {
  const existingAssetIds: string[] = [];
  const missingAssetIds: string[] = [];

  for (const [index, assetId] of assetIds.entries()) {
    if (assets[index]) {
      existingAssetIds.push(assetId);
    } else {
      missingAssetIds.push(assetId);
    }
  }

  return {
    existingAssetIds,
    missingAssetIds,
  };
}

export function prepareUriClassificationBatch(
  assetIds: string[],
  assets: (Pick<BatchAssetInfo, "uri" | "mediaType"> | null | undefined)[],
): {
  assetIdsToClassify: string[];
  assetUrisToClassify: string[];
  prefilledResults: ClassificationResult[];
} {
  const assetIdsToClassify: string[] = [];
  const assetUrisToClassify: string[] = [];
  const prefilledResults: ClassificationResult[] = [];

  for (const [index, assetId] of assetIds.entries()) {
    const asset = assets[index];
    if (!asset) {
      prefilledResults.push(
        createClassificationErrorResult(assetId, "Asset not found"),
      );
      continue;
    }

    if (asset.mediaType !== "photo") {
      prefilledResults.push(
        createClassificationErrorResult(
          assetId,
          "Only photo assets can be classified",
        ),
      );
      continue;
    }

    assetIdsToClassify.push(assetId);
    assetUrisToClassify.push(asset.uri);
  }

  return {
    assetIdsToClassify,
    assetUrisToClassify,
    prefilledResults,
  };
}

export function orderClassificationResults(
  assetIds: string[],
  prefilledResults: ClassificationResult[],
  classifiedResults: ClassificationResult[],
): ClassificationResult[] {
  const orderedResults = new Map<string, ClassificationResult>();

  for (const result of prefilledResults) {
    orderedResults.set(result.assetId, result);
  }

  for (const result of classifiedResults) {
    orderedResults.set(result.assetId, result);
  }

  return assetIds.map(
    (assetId) =>
      orderedResults.get(assetId) ??
      createClassificationErrorResult(assetId, "Classification failed"),
  );
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
