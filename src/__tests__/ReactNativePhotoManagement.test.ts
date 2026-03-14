import {
  createUnsupportedPlatformError,
  processForFoodDetection,
  summarizeCollectedAssets,
  updateScanProgressMetrics,
} from "../ReactNativePhotoManagement.internal";
import type {
  BatchAssetInfo,
  ScanPhotoLibraryProgress,
} from "../ReactNativePhotoManagement.types";

describe("ReactNativePhotoManagement internals", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("filters food labels using thresholds and keywords", () => {
    const result = processForFoodDetection(
      {
        assetId: "asset-1",
        labels: [
          { label: "food", confidence: 0.85 },
          { label: "table", confidence: 0.65 },
          { label: "dessert", confidence: 0.2 },
        ],
      },
      0.3,
      new Set(["food", "dessert"]),
    );

    expect(result.containsFood).toBe(true);
    expect(result.foodConfidence).toBe(0.85);
    expect(result.foodLabels).toEqual([{ label: "food", confidence: 0.85 }]);
  });

  it("creates explicit unsupported-platform errors", () => {
    const error = createUnsupportedPlatformError(
      "detectFoodInImageBatch",
      "android",
    );

    expect(error.name).toBe("UnsupportedPlatformError");
    expect(error.message).toContain("detectFoodInImageBatch");
    expect(error.message).toContain("android");
  });

  it("computes scan progress throughput and eta from processed assets", () => {
    jest.spyOn(Date, "now").mockReturnValue(4_000);

    const progress: ScanPhotoLibraryProgress = {
      totalAssets: 400,
      processedAssets: 200,
      emittedAssets: 190,
      assetsWithLocation: 100,
      skippedAssets: 10,
      isComplete: false,
      elapsedMs: 0,
      assetsPerSecond: 0,
      etaMs: null,
      strategy: "js-fallback",
      deviceTier: "medium",
    };

    const updated = updateScanProgressMetrics(progress, 0);

    expect(updated.elapsedMs).toBe(4_000);
    expect(updated.assetsPerSecond).toBe(50);
    expect(updated.etaMs).toBe(4_000);
  });

  it("counts skipped assets separately from emitted assets", () => {
    const usableAsset: BatchAssetInfo = {
      id: "asset-1",
      uri: "content://asset-1",
      creationTime: 1,
      modificationTime: 2,
      width: 100,
      height: 100,
      mediaType: "photo",
      duration: 0,
      location: {
        latitude: 10,
        longitude: 20,
      },
    };

    const summary = summarizeCollectedAssets([usableAsset, null, undefined]);

    expect(summary.assets).toEqual([usableAsset]);
    expect(summary.assetsWithLocation).toBe(1);
    expect(summary.skippedAssets).toBe(2);
  });
});
