import React, { useMemo, useState } from "react";
import { View, StyleSheet, Text } from "react-native";

// Lazy load WebView to avoid module resolution issues
let WebView: any = null;
try {
  WebView = require("react-native-webview").WebView;
} catch (e) {
  console.warn("WebView not available:", e);
}

interface Props {
  latex: string;
  style?: any;
}

export const LatexRenderer: React.FC<Props> = ({ latex, style }) => {
  const cleanLatex = useMemo(() => {
    // Strip \( \) or \[ \] delimiters if present
    let cleaned = latex.trim();
    if (cleaned.startsWith("\\(") && cleaned.endsWith("\\)")) {
      cleaned = cleaned.slice(2, -2).trim();
    } else if (cleaned.startsWith("\\[") && cleaned.endsWith("\\]")) {
      cleaned = cleaned.slice(2, -2).trim();
    }
    return cleaned;
  }, [latex]);

  const html = useMemo(() => {
    // Escape any quotes and backslashes for JSON
    const escapedLatex = cleanLatex
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/'/g, "\\'");
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
        <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            background: transparent;
            color: #e6ecff;
            font-size: 20px;
            padding: 12px 4px;
            overflow: hidden;
            display: flex;
            align-items: center;
          }
          #math {
            display: inline-block;
            line-height: 1.5;
          }
          .katex {
            font-size: 1.3em;
            color: #e6ecff;
          }
          .katex-display {
            margin: 0;
          }
        </style>
      </head>
      <body>
        <div id="math"></div>
        <script>
          const latex = "${escapedLatex}";
          console.log("Rendering LaTeX:", latex);
          try {
            katex.render(latex, document.getElementById('math'), {
              displayMode: false,
              throwOnError: false,
              trust: true,
              strict: false
            });
            console.log("LaTeX rendered successfully");
          } catch (e) {
            console.error("KaTeX error:", e);
            document.getElementById('math').innerText = latex;
          }
        </script>
      </body>
      </html>
    `;
  }, [cleanLatex]);

  // Fallback if WebView isn't available yet
  if (!WebView) {
    return (
      <View style={[styles.container, style]}>
        <Text style={styles.fallbackText}>{cleanLatex}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <WebView
        source={{ html }}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        style={styles.webview}
        androidLayerType="software"
        originWhitelist={["*"]}
        javaScriptEnabled={true}
        scalesPageToFit={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    minHeight: 50,
    width: "100%",
    backgroundColor: "transparent",
  },
  webview: {
    backgroundColor: "transparent",
    flex: 1,
  },
  fallbackText: {
    color: "#e6ecff",
    fontSize: 18,
    padding: 8,
  },
});

