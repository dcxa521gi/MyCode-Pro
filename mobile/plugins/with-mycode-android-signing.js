const { withAppBuildGradle } = require('expo/config-plugins');

module.exports = function withMyCodeAndroidSigning(config) {
  return withAppBuildGradle(config, (current) => {
    let source = current.modResults.contents;
    const signingMarker = '    signingConfigs {\n';
    const releaseMarker = '            signingConfig signingConfigs.debug\n            def enableShrinkResources';
    if (!source.includes(signingMarker) || !source.includes(releaseMarker)) {
      throw new Error('The generated Android signing template changed; review it before releasing an APK.');
    }
    source = source.replace(signingMarker, `${signingMarker}        mycodeRelease {
            def keystore = System.getenv('MYCODE_ANDROID_KEYSTORE_FILE')
            def password = System.getenv('MYCODE_ANDROID_STORE_PASSWORD')
            if (keystore && password) {
                storeFile file(keystore)
                storePassword password
                keyAlias 'mycode'
                keyPassword password
            }
        }
`);
    source = source.replace(releaseMarker, releaseMarker.replace('signingConfigs.debug', 'signingConfigs.mycodeRelease'));
    current.modResults.contents = source;
    return current;
  });
};
