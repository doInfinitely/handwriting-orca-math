// App.tsx
import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { RootStackParamList } from "./src/types";
import { ProblemsListScreen } from "./src/screens/ProblemsListScreen";
import { ProblemSolveScreen } from "./src/screens/ProblemSolveScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="ProblemsList"
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "#0b1020" },
          }}
        >
          <Stack.Screen name="ProblemsList" component={ProblemsListScreen} />
          <Stack.Screen name="ProblemSolve" component={ProblemSolveScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
