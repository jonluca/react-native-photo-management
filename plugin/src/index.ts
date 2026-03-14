import {
  createRunOncePlugin,
  type ConfigPlugin,
  withPlugins,
} from "expo/config-plugins";

type PluginOptions = {
  photosPermission?: string;
  isAccessMediaLocationEnabled?: boolean;
};

const pkg = require("../../package.json");

const DEFAULT_PHOTOS_PERMISSION =
  "Allow $(PRODUCT_NAME) to access your photos to scan and organize your library.";

const withReactNativePhotoManagement: ConfigPlugin<PluginOptions | void> = (
  config,
  options,
) => {
  const resolvedOptions = options ?? {};
  const {
    photosPermission = DEFAULT_PHOTOS_PERMISSION,
    isAccessMediaLocationEnabled = true,
  } = resolvedOptions;

  return withPlugins(config, [
    [
      "expo-media-library",
      {
        photosPermission,
        savePhotosPermission: false,
        isAccessMediaLocationEnabled,
      },
    ],
  ]);
};

export default createRunOncePlugin(
  withReactNativePhotoManagement,
  pkg.name,
  pkg.version,
);
