# OrcaMath — Single Problem Prototype


A tiny Expo app that shows one problem and lets the learner enter steps line-by-line. The built-in checker recognizes the flow: `x/10 = 6 → x = 60 → 60 − 15 = 45` and marks the final as correct when `45` appears.


## Run


```bash
npm i
npm run start
# press i for iOS simulator or a for Android if configured
```


## Extend next
- Swap TextInput for inking (react-native-skia) while keeping the same `checkNewLine` and `finalCheck` APIs.
- Move the problem into a `/problems` service and fetch it on mount.
- Add per-step timestamps and basic telemetry.
