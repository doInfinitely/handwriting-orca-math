// App.tsx
import React, { useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";

import type { Problem, Step } from "./src/types";
import { checkNewLine, finalCheck, isSolved } from "./src/checker";
import { HandwritingCanvas } from "./src/HandwritingCanvas";
import { recognizeHandwriting } from "./src/mathpix";
import { LatexRenderer } from "./src/LatexRenderer";

const PROBLEM: Problem = {
  id: "demo-yoongi-001",
  question:
    "A number divided by 10 is 6. Yoongi got the result by subtracting 15 from a certain number. What is the result he got?",
  canonicalAnswer: "45",
  skill: ["equation"],
  difficulty: "easy",
};

export default function App() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [typedDraft, setTypedDraft] = useState("");
  const [inkB64, setInkB64] = useState<string | null>(null);
  const [recognizedText, setRecognizedText] = useState<string | null>(null);
  const [recognizing, setRecognizing] = useState(false);
  const [clearCanvasTrigger, setClearCanvasTrigger] = useState(0);
  const solved = useMemo(() => isSolved(steps, PROBLEM), [steps]);

  // --- Typed flow (optional fallback) ---
  const commitTyped = () => {
    const text = typedDraft.trim();
    if (!text) return;
    const res = checkNewLine(PROBLEM, steps, text);
    const newStep: Step = {
      id: `${Date.now()}`,
      text,
      outcome: res.outcome,
      feedback: res.feedback,
    };
    setSteps((prev) => [...prev, newStep]);
    setTypedDraft("");
  };

  // --- Handwriting flow ---
  const recognizeInk = async () => {
    console.log("🔍 Recognize button pressed");
    if (!inkB64) {
      console.log("❌ No inkB64 available");
      return;
    }
    console.log("📤 Calling Mathpix API...");
    setRecognizing(true);
    try {
      const text = await recognizeHandwriting(inkB64);
      console.log("✅ Recognition successful:", text);
      setRecognizedText(text);
    } catch (e: any) {
      console.log("❌ Recognition error:", e);
      Alert.alert("Recognition error", e?.message ?? "Failed to recognize handwriting.");
    } finally {
      setRecognizing(false);
    }
  };

  const commitInk = () => {
    if (!recognizedText) return;
    const res = checkNewLine(PROBLEM, steps, recognizedText);
    const newStep: Step = {
      id: `${Date.now()}`,
      text: recognizedText,
      imageBase64: inkB64 ?? undefined,
      outcome: res.outcome,
      feedback: res.feedback,
    };
    setSteps((prev) => [...prev, newStep]);
    setInkB64(null);
    setRecognizedText(null);
    setClearCanvasTrigger((prev) => prev + 1); // Trigger canvas clear
  };

  const cancelRecognition = () => {
    setRecognizedText(null);
    setInkB64(null);
  };

  const undo = () => setSteps((prev) => prev.slice(0, -1));
  const submitFinal = () => {
    const res = finalCheck(PROBLEM, steps);
    Alert.alert("Submit", res.feedback);
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <View style={styles.container}>
          <Text style={styles.h1}>OrcaMath — Handwriting Prototype</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Problem</Text>
          <Text style={styles.problem}>{PROBLEM.question}</Text>
        </View>

        {/* Handwriting */}
        <View style={styles.card}>
          <Text style={styles.label}>Handwriting</Text>
          <HandwritingCanvas onSnapshot={setInkB64} clearTrigger={clearCanvasTrigger} />
          
          {/* Show snapshot preview if captured */}
          {inkB64 && !recognizedText && (
            <View style={styles.snapshotPreview}>
              <Text style={styles.previewLabel}>Snapshot captured ✓</Text>
              <Image
                source={{ uri: `data:image/png;base64,${inkB64}` }}
                style={styles.snapshotImage}
                resizeMode="contain"
              />
            </View>
          )}
          
          {recognizedText ? (
            <View style={styles.recognitionPreview}>
              <Text style={styles.previewLabel}>Recognized text:</Text>
              <View style={styles.latexContainer}>
                <LatexRenderer latex={recognizedText} />
              </View>
              <View style={styles.rowGap}>
                <Pressable style={styles.btn} onPress={commitInk}>
                  <Text style={styles.btnText}>✓ Commit</Text>
                </Pressable>
                <Pressable style={styles.btnGhost} onPress={cancelRecognition}>
                  <Text style={styles.btnGhostText}>✕ Redraw</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.rowGap}>
              <Pressable
                style={[styles.btn, (!inkB64 || recognizing) && styles.btnDisabled]}
                onPress={recognizeInk}
                disabled={!inkB64 || recognizing}
              >
                <Text style={styles.btnText}>
                  {recognizing ? "Recognizing..." : inkB64 ? "Recognize" : "Write → Snapshot first"}
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Steps */}
        <View style={[styles.card, solved && styles.cardSolved]}>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Your steps</Text>
            <Text style={[styles.badge, solved ? styles.badgeSolved : styles.badgePending]}>
              {solved ? "Solved" : "In progress"}
            </Text>
          </View>

          <FlatList
            data={steps}
            keyExtractor={(s) => s.id}
            contentContainerStyle={{ paddingTop: 6 }}
            renderItem={({ item }) => (
              <View style={styles.stepItem}>
                {item.imageBase64 && (
                  <Image
                    source={{ uri: `data:image/png;base64,${item.imageBase64}` }}
                    style={{ width: 160, height: 60, marginBottom: 6, borderRadius: 6 }}
                    resizeMode="contain"
                  />
                )}
                <View style={styles.stepLatex}>
                  <LatexRenderer latex={item.text} />
                </View>
                <Text
                  style={[
                    styles.stepOutcome,
                    item.outcome === "correct" && styles.ok,
                    item.outcome === "incorrect" && styles.err,
                    item.outcome === "neutral" && styles.neutral,
                  ]}
                >
                  {item.outcome}
                </Text>
                {!!item.feedback && <Text style={styles.feedback}>{item.feedback}</Text>}
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.empty}>No steps yet. Try handwriting “x/10 = 6”.</Text>
            }
          />

          {/* Optional typed input (kept as a fallback) */}
          <View style={styles.inputRow}>
            <TextInput
              value={typedDraft}
              onChangeText={setTypedDraft}
              placeholder="(Optional) Type a line, e.g., x = 60"
              placeholderTextColor="#7f8bc7"
              returnKeyType="done"
              onSubmitEditing={commitTyped}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable style={styles.btn} onPress={commitTyped}>
              <Text style={styles.btnText}>Commit typed</Text>
            </Pressable>
          </View>

          <View className="actions" style={styles.actions}>
            <Pressable
              style={[styles.btnGhost, steps.length === 0 && styles.btnDisabled]}
              onPress={undo}
              disabled={steps.length === 0}
            >
              <Text style={styles.btnGhostText}>Undo</Text>
            </Pressable>
            <Pressable style={styles.btnPrimary} onPress={submitFinal}>
              <Text style={styles.btnPrimaryText}>Submit final</Text>
            </Pressable>
          </View>
        </View>
      </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b1020" },
  container: { flex: 1, padding: 16, gap: 12 },
  h1: { color: "#f3f6ff", fontSize: 22, fontWeight: "700", marginBottom: 4 },

  card: {
    backgroundColor: "#131a33",
    borderRadius: 16,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: "#1f2a4d",
  },
  cardSolved: { borderColor: "#1e6042", backgroundColor: "#102a22" },

  label: { color: "#9bb0ff", fontSize: 12, letterSpacing: 0.5 },
  problem: { color: "#e6ecff", fontSize: 16, lineHeight: 22 },

  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowGap: { flexDirection: "row", gap: 8 },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 12,
    overflow: "hidden",
    color: "#e6ecff",
  },
  badgePending: { backgroundColor: "#2a345c" },
  badgeSolved: { backgroundColor: "#1e6042" },

  stepItem: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: "#1f2a4d" },
  stepText: { color: "#d9e3ff", fontSize: 15 },
  stepOutcome: { marginTop: 2, fontSize: 12 },
  ok: { color: "#6fe3b1" },
  err: { color: "#ff8c8c" },
  neutral: { color: "#aab7ff" },
  feedback: { color: "#b8c6ff", fontSize: 12, marginTop: 2 },
  empty: { color: "#9fb1ff", fontStyle: "italic" },

  inputRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  input: {
    flex: 1,
    backgroundColor: "#0e1430",
    borderColor: "#243269",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#e6ecff",
  },

  btn: {
    backgroundColor: "#243269",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  btnText: { color: "#e6ecff", fontWeight: "700" },

  btnGhost: {
    flex: 1,
    backgroundColor: "#0e1430",
    borderColor: "#243269",
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  btnGhostText: { color: "#cdd8ff", fontWeight: "600" },

  btnPrimary: {
    flex: 1,
    backgroundColor: "#3252ff",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  btnPrimaryText: { color: "#fff", fontWeight: "800" },

  btnDisabled: { opacity: 0.5 },
  actions: { marginTop: 8, flexDirection: "row", gap: 8 },

  snapshotPreview: {
    backgroundColor: "#0e1430",
    borderRadius: 12,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: "#243269",
  },
  snapshotImage: {
    width: "100%",
    height: 100,
    backgroundColor: "#0e1430",
    borderRadius: 8,
  },
  recognitionPreview: {
    backgroundColor: "#0e1430",
    borderRadius: 12,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: "#243269",
  },
  previewLabel: { color: "#9bb0ff", fontSize: 12, letterSpacing: 0.5 },
  previewText: {
    color: "#e6ecff",
    fontSize: 18,
    fontWeight: "600",
    paddingVertical: 8,
  },
  latexContainer: {
    minHeight: 60,
    paddingVertical: 8,
    width: "100%",
  },
  stepLatex: {
    marginVertical: 4,
    minHeight: 50,
  },
});

