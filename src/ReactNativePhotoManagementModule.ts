import { requireOptionalNativeModule } from "expo";
import * as Device from "expo-device";
import * as MediaLibrary from "expo-media-library";
import pMap from "p-map";
import { Platform } from "react-native";

import {
  createUnsupportedPlatformError,
  DEFAULT_FOOD_IDENTIFIERS,
  processForFoodDetection,
  summarizeCollectedAssets,
  updateScanProgressMetrics,
} from "./ReactNativePhotoManagement.internal";
import type {
  AssetLocation,
  AssetMediaType,
  BatchAssetInfo,
  ClassificationLabel,
  CountPhotoLibraryAssetsOptions,
  FoodDetectionOptions,
  FoodDetectionResult,
  PhotoLibraryMediaType,
  ScanPhotoLibraryOptions,
  ScanPhotoLibraryProgress,
} from "./ReactNativePhotoManagement.types";

type NativeClassificationResult = {
  assetId: string;
  labels: ClassificationLabel[];
  error?: string;
};

type NativeModule = {
  getAssetInfoBatch(assetIds: string[]): Promise<BatchAssetInfo[]>;
  classifyImageBatch(
    assetIds: string[],
    options: {
      confidenceThreshold: number;
      maxLabels: number;
    },
  ): Promise<NativeClassificationResult[]>;
};

const MEMORY_THRESHOLDS = {
  low: 2 * 1024 * 1024 * 1024,
  medium: 4 * 1024 * 1024 * 1024,
};
const DEVICE_YEAR_THRESHOLDS = { low: 2018, medium: 2020 };
const TIER_SETTINGS = {
  low: {
    tier: "low" as const,
    batchSize: 25,
    nativeBatchSize: 250,
    concurrency: 5,
  },
  medium: {
    tier: "medium" as const,
    batchSize: 50,
    nativeBatchSize: 500,
    concurrency: 10,
  },
  high: {
    tier: "high" as const,
    batchSize: 100,
    nativeBatchSize: 2000,
    concurrency: 20,
  },
};
const DEFAULT_MEDIA_TYPES: PhotoLibraryMediaType[] = ["photo", "video"];

const nativeModule =
  Platform.OS === "ios"
    ? requireOptionalNativeModule<NativeModule>("ReactNativePhotoManagement")
    : null;

type DeviceTier = (typeof TIER_SETTINGS)[keyof typeof TIER_SETTINGS];

function getDeviceTier(): DeviceTier {
  const { totalMemory, deviceYearClass } = Device;

  let tier: keyof typeof TIER_SETTINGS = "high";
  if (totalMemory != null) {
    if (totalMemory < MEMORY_THRESHOLDS.low) {
      tier = "low";
    } else if (totalMemory < MEMORY_THRESHOLDS.medium) {
      tier = "medium";
    }
  } else if (deviceYearClass != null) {
    if (deviceYearClass <= DEVICE_YEAR_THRESHOLDS.low) {
      tier = "low";
    } else if (deviceYearClass <= DEVICE_YEAR_THRESHOLDS.medium) {
      tier = "medium";
    }
  }

  return TIER_SETTINGS[tier];
}

function ensureNativePlatform(methodName: string): void {
  if (Platform.OS === "web") {
    throw createUnsupportedPlatformError(methodName, Platform.OS);
  }
}

function mapMediaType(
  mediaType: MediaLibrary.MediaTypeValue | null | undefined,
): AssetMediaType {
  if (mediaType === MediaLibrary.MediaType.photo) {
    return "photo";
  }
  if (mediaType === MediaLibrary.MediaType.video) {
    return "video";
  }
  if (mediaType === MediaLibrary.MediaType.audio) {
    return "audio";
  }
  return "unknown";
}

function mapMediaTypes(
  mediaTypes?: PhotoLibraryMediaType[],
): MediaLibrary.MediaTypeValue[] {
  const effectiveMediaTypes =
    mediaTypes && mediaTypes.length > 0 ? mediaTypes : DEFAULT_MEDIA_TYPES;

  return effectiveMediaTypes.map((mediaType) => {
    if (mediaType === "video") {
      return MediaLibrary.MediaType.video;
    }
    if (mediaType === "audio") {
      return MediaLibrary.MediaType.audio;
    }
    return MediaLibrary.MediaType.photo;
  });
}

function mapLocation(
  location: MediaLibrary.AssetInfo["location"] | null | undefined,
): AssetLocation | null {
  if (!location) {
    return null;
  }

  return {
    latitude: location.latitude,
    longitude: location.longitude,
  };
}

function toBatchAssetInfo(asset: MediaLibrary.AssetInfo): BatchAssetInfo {
  return {
    id: asset.id,
    uri: asset.uri,
    creationTime: asset.creationTime ?? 0,
    modificationTime: asset.modificationTime ?? 0,
    width: asset.width ?? 0,
    height: asset.height ?? 0,
    mediaType: mapMediaType(asset.mediaType),
    duration: asset.duration ?? 0,
    location: mapLocation(asset.location),
  };
}

async function getJsFallbackAssetInfoBatch(
  assetIds: string[],
  concurrency: number,
): Promise<{
  assets: BatchAssetInfo[];
  skippedAssets: number;
  assetsWithLocation: number;
}> {
  const assets = await pMap(
    assetIds,
    async (assetId) => {
      try {
        const assetInfo = await MediaLibrary.getAssetInfoAsync(assetId);
        return toBatchAssetInfo(assetInfo);
      } catch {
        return null;
      }
    },
    { concurrency },
  );

  return summarizeCollectedAssets(assets);
}

async function classifyImageBatch(
  assetIds: string[],
  options: Pick<FoodDetectionOptions, "confidenceThreshold" | "maxLabels"> = {},
): Promise<NativeClassificationResult[]> {
  if (!nativeModule) {
    throw createUnsupportedPlatformError("detectFoodInImageBatch", Platform.OS);
  }

  if (assetIds.length === 0) {
    return [];
  }

  return nativeModule.classifyImageBatch(assetIds, {
    confidenceThreshold: options.confidenceThreshold ?? 0.1,
    maxLabels: options.maxLabels ?? 50,
  });
}

export function isNativeBatchAssetInfoAvailable(): boolean {
  return Platform.OS === "ios" && nativeModule != null;
}

export function isFoodDetectionAvailable(): boolean {
  return isNativeBatchAssetInfoAvailable();
}

export async function requestPhotoLibraryPermission(): Promise<boolean> {
  ensureNativePlatform("requestPhotoLibraryPermission");
  const { status } = await MediaLibrary.requestPermissionsAsync();
  return status === "granted";
}

export async function hasPhotoLibraryPermission(): Promise<boolean> {
  ensureNativePlatform("hasPhotoLibraryPermission");
  const { status } = await MediaLibrary.getPermissionsAsync();
  return status === "granted";
}

export async function countPhotoLibraryAssets(
  options: CountPhotoLibraryAssetsOptions = {},
): Promise<number> {
  ensureNativePlatform("countPhotoLibraryAssets");
  const response = await MediaLibrary.getAssetsAsync({
    first: 1,
    mediaType: mapMediaTypes(options.mediaTypes),
  });
  return response.totalCount;
}

export async function getAssetInfoBatch(
  assetIds: string[],
): Promise<BatchAssetInfo[]> {
  ensureNativePlatform("getAssetInfoBatch");

  if (assetIds.length === 0) {
    return [];
  }

  if (isNativeBatchAssetInfoAvailable()) {
    return nativeModule!.getAssetInfoBatch(assetIds);
  }

  const deviceTier = getDeviceTier();
  const result = await getJsFallbackAssetInfoBatch(
    assetIds,
    deviceTier.concurrency,
  );
  return result.assets;
}

export async function detectFoodInImageBatch(
  assetIds: string[],
  options: FoodDetectionOptions = {},
): Promise<FoodDetectionResult[]> {
  if (!isFoodDetectionAvailable()) {
    throw createUnsupportedPlatformError("detectFoodInImageBatch", Platform.OS);
  }

  if (assetIds.length === 0) {
    return [];
  }

  const foodConfidenceThreshold = options.foodConfidenceThreshold ?? 0.3;
  const foodKeywords = options.foodKeywords
    ? new Set(
        options.foodKeywords.map((keyword) => keyword.trim().toLowerCase()),
      )
    : DEFAULT_FOOD_IDENTIFIERS;

  const classificationResults = await classifyImageBatch(assetIds, {
    confidenceThreshold: options.confidenceThreshold,
    maxLabels: options.maxLabels,
  });

  return classificationResults.map((result) =>
    processForFoodDetection(result, foodConfidenceThreshold, foodKeywords),
  );
}

export async function scanPhotoLibrary(
  options: ScanPhotoLibraryOptions = {},
): Promise<ScanPhotoLibraryProgress> {
  ensureNativePlatform("scanPhotoLibrary");

  const strategy = isNativeBatchAssetInfoAvailable()
    ? "ios-native-batch"
    : "js-fallback";
  const deviceTier = getDeviceTier();
  const batchSize =
    options.batchSize ??
    (strategy === "ios-native-batch"
      ? deviceTier.nativeBatchSize
      : deviceTier.batchSize);
  const concurrency = options.concurrency ?? deviceTier.concurrency;
  const totalAssets = await countPhotoLibraryAssets({
    mediaTypes: options.mediaTypes,
  });
  const mediaTypes = mapMediaTypes(options.mediaTypes);

  const progress: ScanPhotoLibraryProgress = {
    totalAssets,
    processedAssets: 0,
    emittedAssets: 0,
    assetsWithLocation: 0,
    skippedAssets: 0,
    isComplete: false,
    elapsedMs: 0,
    assetsPerSecond: 0,
    etaMs: totalAssets === 0 ? 0 : null,
    strategy,
    deviceTier: deviceTier.tier,
  };

  const startedAt = Date.now();
  options.onProgress?.({ ...progress });

  if (totalAssets === 0) {
    const completedProgress = {
      ...progress,
      isComplete: true,
    };
    options.onProgress?.(completedProgress);
    return completedProgress;
  }

  let endCursor: string | undefined;
  let hasNextPage = true;

  while (hasNextPage) {
    const response = await MediaLibrary.getAssetsAsync({
      first: batchSize,
      after: endCursor,
      mediaType: mediaTypes,
      sortBy: [MediaLibrary.SortBy.creationTime],
    });

    const batchAssetIds = response.assets.map((asset) => asset.id);
    const batchResult =
      strategy === "ios-native-batch"
        ? summarizeCollectedAssets(
            await nativeModule!.getAssetInfoBatch(batchAssetIds),
          )
        : await getJsFallbackAssetInfoBatch(batchAssetIds, concurrency);

    if (batchResult.assets.length > 0) {
      await options.onBatch?.(batchResult.assets);
    }

    progress.processedAssets += response.assets.length;
    progress.emittedAssets += batchResult.assets.length;
    progress.assetsWithLocation += batchResult.assetsWithLocation;
    progress.skippedAssets += batchResult.skippedAssets;
    hasNextPage = response.hasNextPage;
    endCursor = response.endCursor;

    const nextProgress = updateScanProgressMetrics(progress, startedAt);
    Object.assign(progress, nextProgress);
    options.onProgress?.({ ...progress });
  }

  const completedProgress = {
    ...updateScanProgressMetrics(progress, startedAt),
    isComplete: true,
    etaMs: 0,
  };
  options.onProgress?.(completedProgress);
  return completedProgress;
}
