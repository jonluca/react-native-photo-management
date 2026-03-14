import { useReducer } from "react";
import {
  Button,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  type BatchAssetInfo,
  countPhotoLibraryAssets,
  detectFoodInImageBatch,
  getAssetInfoBatch,
  hasPhotoLibraryPermission,
  isFoodDetectionAvailable,
  isNativeBatchAssetInfoAvailable,
  requestPhotoLibraryPermission,
  scanPhotoLibrary,
  type ScanPhotoLibraryProgress,
} from "react-native-photo-management";

const SAMPLE_LIMIT = 12;

type AppState = {
  permissionStatus: string;
  count: number | null;
  progress: ScanPhotoLibraryProgress | null;
  sampleAssets: BatchAssetInfo[];
  foodDetectionSummary: string;
  statusMessage: string;
};

type AppStateAction = Partial<AppState> | ((state: AppState) => AppState);

const initialState: AppState = {
  permissionStatus: "unknown",
  count: null,
  progress: null,
  sampleAssets: [],
  foodDetectionSummary: "Not run",
  statusMessage: "Idle",
};

function appStateReducer(state: AppState, action: AppStateAction): AppState {
  if (typeof action === "function") {
    return action(state);
  }

  return {
    ...state,
    ...action,
  };
}

export default function App() {
  const [state, updateState] = useReducer(appStateReducer, initialState);

  async function refreshPermissionStatus() {
    try {
      const granted = await hasPhotoLibraryPermission();
      updateState({ permissionStatus: granted ? "granted" : "not granted" });
    } catch (error) {
      updateState({ permissionStatus: String(error) });
    }
  }

  async function ensurePermission(): Promise<boolean> {
    const granted = await requestPhotoLibraryPermission();
    updateState({ permissionStatus: granted ? "granted" : "not granted" });
    return granted;
  }

  async function handleCountAssets() {
    try {
      const granted = await ensurePermission();
      if (!granted) {
        updateState({ statusMessage: "Photo permission denied." });
        return;
      }

      const nextCount = await countPhotoLibraryAssets();
      updateState({
        count: nextCount,
        statusMessage: `Counted ${nextCount.toLocaleString()} assets.`,
      });
    } catch (error) {
      updateState({ statusMessage: String(error) });
    }
  }

  async function handleReadBatchSample() {
    try {
      const ids = state.sampleAssets.slice(0, 5).map((asset) => asset.id);
      if (ids.length === 0) {
        updateState({
          statusMessage: "Run a scan first to collect sample assets.",
        });
        return;
      }

      const batch = await getAssetInfoBatch(ids);
      updateState({
        statusMessage: `Loaded ${batch.length} assets from getAssetInfoBatch.`,
      });
    } catch (error) {
      updateState({ statusMessage: String(error) });
    }
  }

  async function handleScan() {
    try {
      const granted = await ensurePermission();
      if (!granted) {
        updateState({ statusMessage: "Photo permission denied." });
        return;
      }

      updateState({
        statusMessage: "Scanning photo library...",
        sampleAssets: [],
        foodDetectionSummary: "Not run",
      });

      const nextProgress = await scanPhotoLibrary({
        onBatch: async (assets) => {
          updateState((current) => {
            if (current.sampleAssets.length >= SAMPLE_LIMIT) {
              return current;
            }

            const remaining = SAMPLE_LIMIT - current.sampleAssets.length;
            return {
              ...current,
              sampleAssets: [
                ...current.sampleAssets,
                ...assets.slice(0, remaining),
              ],
            };
          });
        },
        onProgress: (value) => {
          updateState({ progress: value });
        },
      });

      updateState({
        progress: nextProgress,
        statusMessage: `Scan completed with ${nextProgress.strategy}.`,
      });
    } catch (error) {
      updateState({ statusMessage: String(error) });
    }
  }

  async function handleDetectFood() {
    try {
      if (!isFoodDetectionAvailable()) {
        updateState({ foodDetectionSummary: `Unavailable on ${Platform.OS}.` });
        return;
      }

      const photoIds = state.sampleAssets
        .filter((asset) => asset.mediaType === "photo")
        .slice(0, 5)
        .map((asset) => asset.id);

      if (photoIds.length === 0) {
        updateState({
          foodDetectionSummary: "Scan first to collect sample photo assets.",
        });
        return;
      }

      const results = await detectFoodInImageBatch(photoIds);
      const foodAssets = results.filter((result) => result.containsFood).length;
      updateState({
        foodDetectionSummary: `Detected food in ${foodAssets}/${results.length} sampled photos.`,
      });
    } catch (error) {
      updateState({ foodDetectionSummary: String(error) });
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>react-native-photo-management</Text>
        <Text style={styles.subtitle}>
          Native iOS batch metadata plus Vision food detection, with Android JS
          batch scanning fallback.
        </Text>

        <Card title="Runtime">
          <Label label="Platform" value={Platform.OS} />
          <Label label="Permission" value={state.permissionStatus} />
          <Label
            label="Native batch"
            value={String(isNativeBatchAssetInfoAvailable())}
          />
          <Label
            label="Food detection"
            value={String(isFoodDetectionAvailable())}
          />
          <Label label="Status" value={state.statusMessage} />
          <View style={styles.buttonRow}>
            <Button
              title="Refresh permission"
              onPress={refreshPermissionStatus}
            />
          </View>
        </Card>

        <Card title="Library">
          <Label
            label="Asset count"
            value={
              state.count == null ? "Not loaded" : state.count.toLocaleString()
            }
          />
          <View style={styles.buttonRow}>
            <Button title="Count assets" onPress={handleCountAssets} />
          </View>
          <View style={styles.buttonRow}>
            <Button title="Scan library" onPress={handleScan} />
          </View>
          <View style={styles.buttonRow}>
            <Button title="Read batch sample" onPress={handleReadBatchSample} />
          </View>
          <View style={styles.buttonRow}>
            <Button title="Detect food in samples" onPress={handleDetectFood} />
          </View>
        </Card>

        <Card title="Scan Progress">
          <Label
            label="Strategy"
            value={state.progress?.strategy ?? "Not started"}
          />
          <Label
            label="Processed"
            value={
              state.progress
                ? `${state.progress.processedAssets}/${state.progress.totalAssets}`
                : "0/0"
            }
          />
          <Label
            label="Emitted"
            value={state.progress ? String(state.progress.emittedAssets) : "0"}
          />
          <Label
            label="With location"
            value={
              state.progress ? String(state.progress.assetsWithLocation) : "0"
            }
          />
          <Label
            label="Skipped"
            value={state.progress ? String(state.progress.skippedAssets) : "0"}
          />
          <Label
            label="Assets / second"
            value={
              state.progress ? String(state.progress.assetsPerSecond) : "0"
            }
          />
        </Card>

        <Card title="Food Detection">
          <Text style={styles.bodyText}>{state.foodDetectionSummary}</Text>
        </Card>

        <Card title="Sample Assets">
          <Text style={styles.bodyText}>
            Collected sample assets: {state.sampleAssets.length}
          </Text>
          {state.sampleAssets.map((asset) => (
            <View key={asset.id} style={styles.assetRow}>
              <Text style={styles.assetId}>{asset.id}</Text>
              <Text style={styles.assetMeta}>
                {asset.mediaType} • {asset.width}x{asset.height}
              </Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function Card(props: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{props.title}</Text>
      {props.children}
    </View>
  );
}

function Label(props: { label: string; value: string }) {
  return (
    <View style={styles.labelRow}>
      <Text style={styles.label}>{props.label}</Text>
      <Text style={styles.value}>{props.value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f3f5f7",
  },
  container: {
    padding: 20,
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#172033",
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    color: "#516075",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 18,
    gap: 12,
    boxShadow: "0px 8px 18px rgba(16, 35, 63, 0.08)",
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#172033",
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 20,
    color: "#334155",
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  label: {
    fontSize: 14,
    color: "#516075",
  },
  value: {
    flex: 1,
    fontSize: 14,
    color: "#172033",
    textAlign: "right",
  },
  buttonRow: {
    marginTop: 4,
  },
  assetRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#d7dce2",
    paddingTop: 10,
    gap: 4,
  },
  assetId: {
    fontSize: 12,
    color: "#172033",
  },
  assetMeta: {
    fontSize: 12,
    color: "#64748b",
  },
});
