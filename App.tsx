// App.tsx
import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { RootStackParamList } from "./src/types";
import { AuthProvider, useAuth } from "./src/contexts/AuthContext";
import { LoginScreen } from "./src/screens/LoginScreen";
import { SignupScreen } from "./src/screens/SignupScreen";
import { ProblemsListScreen } from "./src/screens/ProblemsListScreen";
import { ProblemSolveScreen } from "./src/screens/ProblemSolveScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { ActivityIndicator, View } from "react-native";

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0b1020", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#3252ff" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={user ? "ProblemsList" : "Login"}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#0b1020" },
        }}
      >
        {user ? (
          // Authenticated screens
          <>
            <Stack.Screen name="ProblemsList" component={ProblemsListScreen} />
            <Stack.Screen name="ProblemSolve" component={ProblemSolveScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
          </>
        ) : (
          // Auth screens
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
