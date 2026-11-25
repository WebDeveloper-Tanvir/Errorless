import { dirname } from "path"
import { fileURLToPath } from "url"
import { FlatCompat } from "@eslint/eslintrc"

const __dirname = dirname(fileURLToPath(import.meta.url))
const compat = new FlatCompat({ baseDirectory: __dirname })

const config = [
  { ignores: [".next/**", "node_modules/**", "convex/_generated/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Existing code (learn, quiz, IDE, lib) uses `any` widely. Surfaced as warnings so
    // `npm run lint` is usable today; tighten back to "error" as those files are typed.
    rules: { "@typescript-eslint/no-explicit-any": "warn" },
  },
]

export default config
