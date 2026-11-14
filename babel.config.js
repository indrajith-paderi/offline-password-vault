module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    env: {
      // Belt and braces: release builds physically cannot log, so nothing secret ends up in logcat.
      production: {
        plugins: [['transform-remove-console', { exclude: [] }]],
      },
    },
  };
};
