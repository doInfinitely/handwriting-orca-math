// index.js
import "react-native-gesture-handler";  // first
import "react-native-reanimated";       // second

import { registerRootComponent } from "expo";
import App from "./App";
registerRootComponent(App);
