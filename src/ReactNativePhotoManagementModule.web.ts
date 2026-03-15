import { createUnsupportedPlatformError } from "./ReactNativePhotoManagement.internal";
import type {
  BatchAssetInfo,
  ClassificationOptions,
  ClassificationResult,
  CountPhotoLibraryAssetsOptions,
  CreateAlbumWithAssetsOptions,
  CreateAlbumWithAssetsResult,
  DeleteAssetsBatchResult,
  FoodDetectionOptions,
  FoodDetectionResult,
  ScanPhotoLibraryOptions,
  ScanPhotoLibraryProgress,
} from "./ReactNativePhotoManagement.types";

function unsupported(methodName: string): Error {
  return createUnsupportedPlatformError(methodName, "web");
}

export function isNativeBatchAssetInfoAvailable(): boolean {
  return false;
}

export function isFoodDetectionAvailable(): boolean {
  return false;
}

export async function requestPhotoLibraryPermission(): Promise<boolean> {
  throw unsupported("requestPhotoLibraryPermission");
}

export async function hasPhotoLibraryPermission(): Promise<boolean> {
  throw unsupported("hasPhotoLibraryPermission");
}

export async function countPhotoLibraryAssets(
  _options: CountPhotoLibraryAssetsOptions = {},
): Promise<number> {
  throw unsupported("countPhotoLibraryAssets");
}

export async function getAssetInfoBatch(
  _assetIds: string[],
): Promise<BatchAssetInfo[]> {
  throw unsupported("getAssetInfoBatch");
}

export async function classifyImageBatch(
  _assetIds: string[],
  _options: ClassificationOptions = {},
): Promise<ClassificationResult[]> {
  throw unsupported("classifyImageBatch");
}

export async function detectFoodInImageBatch(
  _assetIds: string[],
  _options: FoodDetectionOptions = {},
): Promise<FoodDetectionResult[]> {
  throw unsupported("detectFoodInImageBatch");
}

export async function deleteAssetsBatch(
  _assetIds: string[],
): Promise<DeleteAssetsBatchResult> {
  throw unsupported("deleteAssetsBatch");
}

export async function createAlbumWithAssets(
  _albumName: string,
  _assetIds: string[],
  _options: CreateAlbumWithAssetsOptions = {},
): Promise<CreateAlbumWithAssetsResult> {
  throw unsupported("createAlbumWithAssets");
}

export async function scanPhotoLibrary(
  _options: ScanPhotoLibraryOptions = {},
): Promise<ScanPhotoLibraryProgress> {
  throw unsupported("scanPhotoLibrary");
}
