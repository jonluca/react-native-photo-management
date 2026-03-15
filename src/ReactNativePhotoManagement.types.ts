export interface AssetLocation {
  latitude: number;
  longitude: number;
  altitude?: number | null;
  speed?: number | null;
  heading?: number | null;
}

export type PhotoLibraryMediaType = "photo" | "video" | "audio";

export type AssetMediaType = PhotoLibraryMediaType | "unknown";

export interface BatchAssetInfo {
  id: string;
  uri: string;
  creationTime: number;
  modificationTime: number;
  width: number;
  height: number;
  mediaType: AssetMediaType;
  duration: number;
  location: AssetLocation | null;
}

export interface ClassificationLabel {
  label: string;
  confidence: number;
}

export interface ClassificationOptions {
  confidenceThreshold?: number;
  maxLabels?: number;
}

export interface ClassificationResult {
  assetId: string;
  labels: ClassificationLabel[];
  error?: string;
}

export interface FoodDetectionOptions extends ClassificationOptions {
  foodConfidenceThreshold?: number;
  foodKeywords?: string[];
}

export interface FoodDetectionResult {
  assetId: string;
  containsFood: boolean;
  foodConfidence: number;
  foodLabels: ClassificationLabel[];
  labels: ClassificationLabel[];
  error?: string;
}

export interface CountPhotoLibraryAssetsOptions {
  mediaTypes?: PhotoLibraryMediaType[];
}

export interface CreateAlbumWithAssetsOptions {
  copyAsset?: boolean;
}

export interface CreateAlbumWithAssetsResult {
  success: boolean;
  albumId?: string;
  albumName: string;
  assetCount: number;
  created: boolean;
  skippedAssets: number;
  missingAssetIds: string[];
  error?: string;
}

export interface DeleteAssetsBatchResult {
  requestedCount: number;
  deletedCount: number;
  skippedAssets: number;
  missingAssetIds: string[];
  success: boolean;
  error?: string;
}

export type ScanStrategy = "ios-native-batch" | "js-fallback";

export interface ScanPhotoLibraryProgress {
  totalAssets: number;
  processedAssets: number;
  emittedAssets: number;
  assetsWithLocation: number;
  skippedAssets: number;
  isComplete: boolean;
  elapsedMs: number;
  assetsPerSecond: number;
  etaMs: number | null;
  strategy: ScanStrategy;
  deviceTier: "low" | "medium" | "high";
}

export interface ScanPhotoLibraryOptions extends CountPhotoLibraryAssetsOptions {
  batchSize?: number;
  concurrency?: number;
  onBatch?: (assets: BatchAssetInfo[]) => void | Promise<void>;
  onProgress?: (progress: ScanPhotoLibraryProgress) => void;
}
