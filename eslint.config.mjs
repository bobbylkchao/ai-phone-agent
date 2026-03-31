import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { FlatCompat } from '@eslint/eslintrc'
import { defineConfig } from 'eslint/config'
import globals from 'globals'
import eslintConfigPrettier from 'eslint-config-prettier'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

/** Airbnb (base + TypeScript) via @kesills/eslint-config-airbnb-typescript; Prettier last to disable conflicting stylistic rules. */
export default defineConfig(
  { ignores: ['dist/**', 'node_modules/**'] },
  ...compat.extends('airbnb-base'),
  ...compat.extends('@kesills/eslint-config-airbnb-typescript/base'),
  eslintConfigPrettier,
  {
    files: ['src/**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: path.join(__dirname, 'tsconfig.json'),
        },
      },
    },
    rules: {
      // TypeScript: omit extensions in imports; resolver handles resolution.
      'import/extensions': [
        'error',
        'ignorePackages',
        { js: 'never', jsx: 'never', ts: 'never', tsx: 'never' },
      ],
      // This codebase uses named exports throughout.
      'import/prefer-default-export': 'off',
      // Subpath packages (e.g. OpenAI) and demo agents do not always map 1:1 to package.json.
      'import/no-extraneous-dependencies': 'off',
      // Legitimate cycles exist between tools and websocket bootstrap.
      'import/no-cycle': 'off',
      'import/no-mutable-exports': 'off',

      '@typescript-eslint/no-explicit-any': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
        },
      ],

      'no-console': 'off',
      'no-void': 'off',
      'no-await-in-loop': 'off',
      'no-restricted-syntax': 'off',
      'no-param-reassign': [
        'error',
        {
          props: true,
          ignorePropertyModificationsFor: [
            'ws',
            'socket',
            'req',
            'res',
            'ctx',
            'acc',
          ],
        },
      ],
    },
  }
)
