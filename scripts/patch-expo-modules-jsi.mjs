import fs from "node:fs";
import path from "node:path";

const target = path.join(
  process.cwd(),
  "node_modules/expo-modules-jsi/apple/Sources/ExpoModulesJSI/Coding/JavaScriptCodable+Date.swift"
);

if (fs.existsSync(target)) {
  const before = fs.readFileSync(target, "utf8");
  const after = before.replace(
    /(?:Swift\.|Foundation\.f|Foundation\.fFoundation\.f)?abs\(milliseconds\) <= maxJavaScriptDateMilliseconds/g,
    "Foundation.fabs(milliseconds) <= maxJavaScriptDateMilliseconds"
  );
  if (after !== before) {
    fs.writeFileSync(target, after);
    console.log("Patched expo-modules-jsi JavaScriptCodable+Date.swift for Swift 6.3 type inference.");
  }
}
