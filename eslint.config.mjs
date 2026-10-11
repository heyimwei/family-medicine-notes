import path from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";
import { globalIgnores } from "eslint/config";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: currentDirectory });

const config = [
  ...compat.extends("next/core-web-vitals"),
  globalIgnores([".next/**", "node_modules/**"]),
];

export default config;
