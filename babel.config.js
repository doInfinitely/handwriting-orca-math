module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      // other plugins here (if any)
      "react-native-reanimated/plugin", // keep this LAST
    ],
  };
};
