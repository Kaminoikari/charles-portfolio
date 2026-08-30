import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // The CLI tools print aligned tables of Chinese labels, and the character
    // that aligns a column of CJK glyphs is U+3000, whose width matches them;
    // an ASCII space is half as wide and leaves the columns ragged. The rule is
    // right to flag an invisible character in code, so it stays on everywhere
    // else and stays on for these files outside a template literal — only the
    // report strings themselves are exempt.
    files: ['scripts/**/*.ts'],
    rules: {
      'no-irregular-whitespace': ['error', { skipTemplates: true }],
    },
  },
])
