import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Pressable, Text, StyleSheet } from "react-native";
import { PanGestureHandler, PanGestureHandlerGestureEvent } from "react-native-gesture-handler";
import { Canvas, Path, Skia, SkPath, ImageFormat } from "@shopify/react-native-skia";

type Stroke = { id: number; path: SkPath };

interface Props {
  onSnapshot: (pngBase64: string) => void;
  clearTrigger?: number;
}

export const HandwritingCanvas: React.FC<Props> = ({ onSnapshot, clearTrigger }) => {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const current = useRef<Stroke | null>(null);
  const canvasRef = useRef<any>(null);

  // Clear canvas when clearTrigger changes
  useEffect(() => {
    if (clearTrigger && clearTrigger > 0) {
      setStrokes([]);
    }
  }, [clearTrigger]);

  const beginStroke = (x: number, y: number) => {
    const p = Skia.Path.Make();
    p.moveTo(x, y);
    current.current = { id: Date.now(), path: p };
    setStrokes((prev) => [...prev, current.current!]);
  };

  const extendStroke = (x: number, y: number) => {
    if (!current.current) return;
    current.current.path.lineTo(x, y);
    setStrokes((prev) => [...prev]); // force repaint
  };

  const endStroke = () => {
    current.current = null;
  };

  // ✅ No minDist + activeOffset together. Use defaults.
  const onGestureEvent = ({ nativeEvent }: PanGestureHandlerGestureEvent) => {
    const { x, y } = nativeEvent as any;
    if (x == null || y == null) return;
    if (!current.current) beginStroke(x, y);
    else extendStroke(x, y);
  };

  const onHandlerStateChange = ({ nativeEvent }: PanGestureHandlerGestureEvent) => {
    const { state, x, y } = nativeEvent as any;
    // 2=BEGAN, 4=ACTIVE, 5=END, 3=CANCELLED, 1=FAILED
    if (state === 2) beginStroke(x, y);
    if (state === 5 || state === 3 || state === 1) endStroke();
  };

  const clear = () => setStrokes([]);
  const snapshot = () => {
    console.log("📸 Snapshot button pressed");
    
    // Create a new surface with white background and black strokes for Mathpix
    const width = 1360; // Match the dimensions from Mathpix response
    const height = 440;
    const surface = Skia.Surface.Make(width, height);
    if (!surface) {
      console.log("❌ Could not create surface");
      return;
    }

    const canvas = surface.getCanvas();
    
    // Fill with white background
    const whitePaint = Skia.Paint();
    whitePaint.setColor(Skia.Color("#ffffff"));
    canvas.drawRect({ x: 0, y: 0, width, height }, whitePaint);
    
    // Draw all strokes in black
    const blackPaint = Skia.Paint();
    blackPaint.setColor(Skia.Color("#000000"));
    blackPaint.setStyle(1); // 1 = Stroke style
    blackPaint.setStrokeWidth(4);
    blackPaint.setStrokeJoin(1); // round
    blackPaint.setStrokeCap(1); // round
    
    strokes.forEach(({ path }) => {
      canvas.drawPath(path, blackPaint);
    });

    // Snapshot the inverted canvas
    const image = surface.makeImageSnapshot();
    if (!image) {
      console.log("❌ No image captured from surface");
      return;
    }

    let b64: string | undefined;

    try {
      // Newer Skia: expects enum number (PNG = 1)
      b64 = image.encodeToBase64(ImageFormat.PNG, 100);
      console.log("✅ Encoded with ImageFormat.PNG");
    } catch {
      // Older Skia: no-arg version defaults to PNG
      // @ts-ignore
      b64 = image.encodeToBase64?.();
      console.log("✅ Encoded with legacy method");
    }

    if (b64) {
      console.log("✅ Snapshot successful, length:", b64.length);
      onSnapshot(b64);
    } else {
      console.log("❌ No base64 data generated");
    }
  };

  // Simple visual cue if nothing is drawn yet
  const empty = useMemo(() => strokes.length === 0, [strokes.length]);

  return (
    <View style={styles.wrap}>
      <View style={styles.canvasOuter}>
        <PanGestureHandler
          onGestureEvent={onGestureEvent as any}
          onHandlerStateChange={onHandlerStateChange as any}
        >
          <View style={styles.gestureLayer}>
            {/* @ts-ignore */}
            <Canvas ref={canvasRef} style={styles.canvas}>
              {strokes.map(({ id, path }) => (
                <Path
                  key={id}
                  path={path}
                  style="stroke"
                  strokeWidth={3}
                  strokeJoin="round"
                  strokeCap="round"
                  color="#ffffff"
                />
              ))}
            </Canvas>
          </View>
        </PanGestureHandler>
        {empty && <Text style={styles.hint}>Write here</Text>}
      </View>

      <View style={styles.row}>
        <Pressable style={styles.btn} onPress={clear}>
          <Text style={styles.btnText}>Clear</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={snapshot}>
          <Text style={styles.btnText}>Snapshot</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  canvasOuter: {
    position: "relative",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#243269",
  },
  gestureLayer: { width: "100%", height: 220, backgroundColor: "#0e1430" },
  canvas: { width: "100%", height: "100%" },
  hint: {
    position: "absolute",
    top: 8,
    left: 10,
    color: "#7f8bc7",
    fontSize: 12,
  },
  row: { flexDirection: "row", gap: 8 },
  btn: {
    backgroundColor: "#243269",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  btnText: { color: "#e6ecff", fontWeight: "700" },
});
