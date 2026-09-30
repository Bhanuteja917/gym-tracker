// iOS 27 asserts at launch unless the app adopts the UIScene life cycle. Expo
// ships `ExpoAppSceneDelegate` for this, but the SDK 57 prebuild template still
// starts React Native from the app delegate, so wire the scene delegate in here.
const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

const WINDOW_SETUP = /\n#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n[\s\S]*?#endif\n/;

function withSceneManifest(config) {
  return withInfoPlist(config, (config) => {
    config.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: 'EXExpoAppSceneDelegate',
          },
        ],
      },
    };
    return config;
  });
}

function withSceneAppDelegate(config) {
  return withAppDelegate(config, (config) => {
    if (config.modResults.language !== 'swift') {
      throw new Error('with-scene-lifecycle: expected a Swift AppDelegate');
    }
    let contents = config.modResults.contents;

    if (!contents.includes('ExpoReactNativeFactoryProvider')) {
      const declaration = 'class AppDelegate: ExpoAppDelegate {';
      if (!contents.includes(declaration)) {
        throw new Error('with-scene-lifecycle: AppDelegate declaration not found');
      }
      contents = contents.replace(
        declaration,
        'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {',
      );
    }

    // The scene delegate creates the window and starts React Native into it.
    if (WINDOW_SETUP.test(contents)) {
      contents = contents.replace(WINDOW_SETUP, '\n');
    } else if (contents.includes('UIWindow(frame:')) {
      throw new Error('with-scene-lifecycle: could not remove app-delegate window setup');
    }

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = function withSceneLifecycle(config) {
  return withSceneAppDelegate(withSceneManifest(config));
};
