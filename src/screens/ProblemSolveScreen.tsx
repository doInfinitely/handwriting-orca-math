import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";

import type { Problem, Step, RootStackParamList } from "../types";
import { checkNewLine, finalCheck } from "../checker";
import { HandwritingCanvas } from "../HandwritingCanvas";
import { recognizeHandwriting } from "../mathpix";
import { LatexRenderer } from "../LatexRenderer";
import { useAuth } from "../contexts/AuthContext";
import { supabase, ProblemAttempt, StepData } from "../lib/supabase";

type ProblemSolveScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "ProblemSolve"
>;

type ProblemSolveScreenRouteProp = RouteProp<RootStackParamList, "ProblemSolve">;

interface Props {
  navigation: ProblemSolveScreenNavigationProp;
  route: ProblemSolveScreenRouteProp;
}

export function ProblemSolveScreen({ navigation, route }: Props) {
  const { problem } = route.params;
  const { user } = useAuth();
  
  const [steps, setSteps] = useState<Step[]>([]);
  const [typedDraft, setTypedDraft] = useState("");
  const [recognizedText, setRecognizedText] = useState<string | null>(null);
  const [recognizedImage, setRecognizedImage] = useState<string | null>(null);
  const [recognizing, setRecognizing] = useState(false);
  const [clearCanvasTrigger, setClearCanvasTrigger] = useState(0);
  const [validating, setValidating] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const hasSavedRef = useRef(false);
  const isLoadingRef = useRef(false);

  // Check if solved based on step outcomes
  const solved = useMemo(() => {
    return steps.some(s => s.outcome === "correct") && 
           steps[steps.length - 1]?.outcome === "correct";
  }, [steps]);

  // Load existing attempt or create new one
  useEffect(() => {
    if (user) {
      loadOrCreateAttempt();
    }
  }, [user, problem.id]);

  // Save progress whenever steps change (but not during initial load)
  useEffect(() => {
    if (user && attemptId && steps.length > 0 && !hasSavedRef.current && !isLoadingRef.current) {
      console.log('💾 Auto-saving progress...', steps.length, 'steps');
      hasSavedRef.current = true;
      saveProgress().finally(() => {
        hasSavedRef.current = false;
      });
    }
  }, [steps, attemptId, user]);

  // Update activity when solved
  useEffect(() => {
    if (solved && user && attemptId) {
      markAsSolved();
    }
  }, [solved, user, attemptId]);

  const loadOrCreateAttempt = async () => {
    if (!user) return;

    isLoadingRef.current = true;
    console.log('📂 Loading or creating attempt for problem', problem.id);
    
    try {
      // Check for existing unsolved attempt
      const { data: unsolved } = await supabase
        .from('problem_attempts')
        .select('*')
        .eq('user_id', user.id)
        .eq('problem_id', String(problem.id))
        .eq('is_solved', false)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (unsolved) {
        console.log('✅ Found existing unsolved attempt:', unsolved.id);
        setAttemptId(unsolved.id);
        // Load existing steps
        if (unsolved.steps && Array.isArray(unsolved.steps)) {
          const loadedSteps: Step[] = unsolved.steps.map((s: StepData) => ({
            id: s.id,
            text: s.text,
            outcome: s.outcome,
            feedback: s.feedback,
            imageBase64: s.imageBase64,
          }));
          console.log('📥 Loaded', loadedSteps.length, 'steps from unsolved attempt');
          setSteps(loadedSteps);
        }
        return;
      }

      // No unsolved attempt, check for most recent solved attempt to show previous work
      const { data: solved } = await supabase
        .from('problem_attempts')
        .select('*')
        .eq('user_id', user.id)
        .eq('problem_id', String(problem.id))
        .eq('is_solved', true)
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (solved) {
        console.log('✅ Found previous solved attempt:', solved.id);
        setAttemptId(solved.id);
        // Load steps from solved attempt (read-only view of previous work)
        if (solved.steps && Array.isArray(solved.steps)) {
          const loadedSteps: Step[] = solved.steps.map((s: StepData) => ({
            id: s.id,
            text: s.text,
            outcome: s.outcome,
            feedback: s.feedback,
            imageBase64: s.imageBase64,
          }));
          console.log('📥 Loaded', loadedSteps.length, 'steps from previous solved attempt');
          setSteps(loadedSteps);
        }
        return;
      }

      // No existing attempt at all, create new one
      console.log('🆕 Creating new attempt');
      const { data: newAttempt, error } = await supabase
        .from('problem_attempts')
        .insert({
          user_id: user.id,
          problem_id: String(problem.id),
          problem_question: problem.question,
          steps: [],
          is_solved: false,
        })
        .select()
        .single();

      if (error) throw error;
      console.log('✅ Created new attempt:', newAttempt.id);
      setAttemptId(newAttempt.id);
    } catch (error) {
      console.error('❌ Error loading/creating attempt:', error);
    } finally {
      isLoadingRef.current = false;
    }
  };

  const saveProgress = async () => {
    if (!user || !attemptId) return;

    try {
      const stepsData: StepData[] = steps.map(s => ({
        id: s.id,
        text: s.text,
        outcome: s.outcome,
        feedback: s.feedback,
        imageBase64: s.imageBase64,
        timestamp: new Date().toISOString(),
      }));

      console.log('💾 Saving', stepsData.length, 'steps to attempt:', attemptId);
      
      const { error } = await supabase
        .from('problem_attempts')
        .update({
          steps: stepsData,
          last_updated: new Date().toISOString(),
        })
        .eq('id', attemptId);

      if (error) {
        console.error('❌ Failed to save progress:', error);
        throw error;
      }
      
      console.log('✅ Progress saved successfully');
    } catch (error) {
      console.error('❌ Error saving progress:', error);
    }
  };

  const logStepToActivity = async () => {
    if (!user) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: existingActivity } = await supabase
        .from('activity_log')
        .select('*')
        .eq('user_id', user.id)
        .eq('activity_date', today)
        .maybeSingle();

      if (existingActivity) {
        await supabase
          .from('activity_log')
          .update({
            steps_completed: existingActivity.steps_completed + 1,
          })
          .eq('id', existingActivity.id);
      } else {
        await supabase
          .from('activity_log')
          .insert({
            user_id: user.id,
            activity_date: today,
            problems_solved: 0,
            steps_completed: 1,
          });
      }
      console.log('📈 Step logged to activity');
    } catch (error) {
      console.error('❌ Error logging step to activity:', error);
    }
  };

  const markAsSolved = async () => {
    if (!user || !attemptId) return;

    try {
      // Update attempt as solved
      await supabase
        .from('problem_attempts')
        .update({
          is_solved: true,
          completed_at: new Date().toISOString(),
        })
        .eq('id', attemptId);

      // Check if this problem was solved before (for unique count)
      const { data: previouslySolved } = await supabase
        .from('problem_attempts')
        .select('id')
        .eq('user_id', user.id)
        .eq('problem_id', String(problem.id))
        .eq('is_solved', true)
        .neq('id', attemptId) // Exclude current attempt
        .limit(1)
        .maybeSingle();

      const isFirstTimeSolving = !previouslySolved;
      console.log(isFirstTimeSolving ? '🎉 First time solving this problem!' : '♻️ Re-solving this problem');

      // Update activity log with problem solved (steps already logged in real-time)
      const today = new Date().toISOString().split('T')[0];
      const { data: existingActivity } = await supabase
        .from('activity_log')
        .select('*')
        .eq('user_id', user.id)
        .eq('activity_date', today)
        .maybeSingle();

      if (existingActivity) {
        // Only increment problems_solved if first time solving this problem
        if (isFirstTimeSolving) {
          await supabase
            .from('activity_log')
            .update({
              problems_solved: existingActivity.problems_solved + 1,
            })
            .eq('id', existingActivity.id);
        }
      } else {
        await supabase
          .from('activity_log')
          .insert({
            user_id: user.id,
            activity_date: today,
            problems_solved: isFirstTimeSolving ? 1 : 0,
            steps_completed: 0, // Steps already logged in real-time
          });
      }
    } catch (error) {
      console.error('❌ Error marking as solved:', error);
    }
  };

  // --- Typed flow (optional fallback) ---
  const commitTyped = async () => {
    const text = typedDraft.trim();
    if (!text) return;
    setValidating(true);
    try {
      const res = await checkNewLine(problem, steps, text);
      const newStep: Step = {
        id: `${Date.now()}`,
        text,
        outcome: res.outcome,
        feedback: res.feedback,
      };
      setSteps((prev) => [...prev, newStep]);
      setTypedDraft("");
      // Log step to activity in real-time
      await logStepToActivity();
    } catch (e) {
      console.error("Validation error:", e);
      Alert.alert("Error", "Failed to validate step. Please try again.");
    } finally {
      setValidating(false);
    }
  };

  // --- Handwriting flow ---
  const handleRecognize = async (imageB64: string) => {
    console.log("🔍 Recognition started with image");
    setRecognizing(true);
    setRecognizedImage(imageB64);
    try {
      const text = await recognizeHandwriting(imageB64);
      console.log("✅ Recognition successful:", text);
      setRecognizedText(text);
    } catch (e: any) {
      console.log("❌ Recognition error:", e);
      Alert.alert("Recognition error", e?.message ?? "Failed to recognize handwriting.");
      setRecognizedImage(null);
    } finally {
      setRecognizing(false);
    }
  };

  const commitInk = async () => {
    if (!recognizedText) return;
    setValidating(true);
    try {
      const res = await checkNewLine(problem, steps, recognizedText);
      const newStep: Step = {
        id: `${Date.now()}`,
        text: recognizedText,
        imageBase64: recognizedImage ?? undefined,
        outcome: res.outcome,
        feedback: res.feedback,
      };
      setSteps((prev) => [...prev, newStep]);
      setRecognizedImage(null);
      setRecognizedText(null);
      setClearCanvasTrigger((prev) => prev + 1);
      // Log step to activity in real-time
      await logStepToActivity();
    } catch (e) {
      console.error("Validation error:", e);
      Alert.alert("Error", "Failed to validate step. Please try again.");
    } finally {
      setValidating(false);
    }
  };

  const cancelRecognition = () => {
    setRecognizedText(null);
    setRecognizedImage(null);
  };

  const undo = async () => {
    if (steps.length === 0) return;
    
    setSteps((prev) => prev.slice(0, -1));
    
    // Decrement step count in activity log
    if (user) {
      try {
        const today = new Date().toISOString().split('T')[0];
        const { data: existingActivity } = await supabase
          .from('activity_log')
          .select('*')
          .eq('user_id', user.id)
          .eq('activity_date', today)
          .maybeSingle();

        if (existingActivity && existingActivity.steps_completed > 0) {
          await supabase
            .from('activity_log')
            .update({
              steps_completed: existingActivity.steps_completed - 1,
            })
            .eq('id', existingActivity.id);
          console.log('📉 Step removed from activity');
        }
      } catch (error) {
        console.error('❌ Error removing step from activity:', error);
      }
    }
  };
  
  const submitFinal = async () => {
    setValidating(true);
    try {
      const res = await finalCheck(problem, steps);
      Alert.alert("Submit", res.feedback);
    } catch (e) {
      console.error("Final check error:", e);
      Alert.alert("Error", "Failed to check solution. Please try again.");
    } finally {
      setValidating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView 
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header with back button */}
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </Pressable>
          <Text style={styles.problemId}>Problem #{problem.id}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Problem</Text>
          <Text style={styles.problem}>{problem.question}</Text>
        </View>

        {/* Handwriting */}
        <View style={styles.card}>
          <Text style={styles.label}>Handwriting</Text>
          <HandwritingCanvas onRecognize={handleRecognize} clearTrigger={clearCanvasTrigger} />
          
          {recognizing && (
            <View style={styles.recognizingIndicator}>
              <Text style={styles.recognizingText}>🔍 Recognizing...</Text>
            </View>
          )}
          
          {recognizedText && (
            <View style={styles.recognitionPreview}>
              <Text style={styles.previewLabel}>Recognized text:</Text>
              {recognizedImage && (
                <Image
                  source={{ uri: `data:image/png;base64,${recognizedImage}` }}
                  style={styles.snapshotImage}
                  resizeMode="contain"
                />
              )}
              <View style={styles.latexContainer}>
                <LatexRenderer latex={recognizedText} />
              </View>
              <View style={styles.rowGap}>
                <Pressable 
                  style={[styles.btn, validating && styles.btnDisabled]} 
                  onPress={commitInk}
                  disabled={validating}
                >
                  <Text style={styles.btnText}>
                    {validating ? "Validating..." : "✓ Commit"}
                  </Text>
                </Pressable>
                <Pressable 
                  style={[styles.btnGhost, validating && styles.btnDisabled]} 
                  onPress={cancelRecognition}
                  disabled={validating}
                >
                  <Text style={styles.btnGhostText}>✕ Redraw</Text>
                </Pressable>
              </View>
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

          {steps.length > 0 ? (
            steps.map((item) => (
              <View key={item.id} style={styles.stepItem}>
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
            ))
          ) : (
            <Text style={styles.empty}>No steps yet. Start by writing your solution.</Text>
          )}

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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b1020" },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  backButton: {
    backgroundColor: "#243269",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  backButtonText: { color: "#e6ecff", fontWeight: "600" },
  problemId: { color: "#9bb0ff", fontSize: 14 },

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
  stepLatex: {
    marginVertical: 4,
    minHeight: 50,
  },
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

  recognizingIndicator: {
    backgroundColor: "#0e1430",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#243269",
  },
  recognizingText: {
    color: "#9bb0ff",
    fontSize: 14,
    fontWeight: "600",
  },
  snapshotImage: {
    width: "100%",
    height: 80,
    backgroundColor: "#0e1430",
    borderRadius: 8,
    marginBottom: 8,
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
  latexContainer: {
    minHeight: 60,
    paddingVertical: 8,
    width: "100%",
  },
});


