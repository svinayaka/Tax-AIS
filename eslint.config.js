import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import sonarjs from 'eslint-plugin-sonarjs';

export default [
  js.configs.recommended,
  sonarjs.configs.recommended,
  {
    files: ['src/**/*.{ts,js}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        File: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
        fetch: 'readonly',
        performance: 'readonly',
        setTimeout: 'readonly',
        customElements: 'readonly',
        HTMLElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLCanvasElement: 'readonly',
        HTMLButtonElement: 'readonly',
        DragEvent: 'readonly',
        requestAnimationFrame: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,

      // SonarQube TypeScript & Code Quality Rules
      'sonarjs/cognitive-complexity': ['error', 30],
      'sonarjs/regex-complexity': 'off', // Specialized multi-token tax & entity regexes
      'sonarjs/no-duplicate-string': 'off', // Tax codes, schema keys, and token names legitimately repeat
      'sonarjs/table-header-reference': 'off', // Custom Web Component shadow/light DOM tables
      'sonarjs/table-header': 'off',
      'sonarjs/link-with-target-blank': 'warn',
      'sonarjs/slow-regex': 'off', // Complex spatial tax regex patterns
      'sonarjs/redundant-type-aliases': 'error',
      'sonarjs/prefer-type-guard': 'error',
      'sonarjs/no-useless-intersection': 'error',
      'sonarjs/no-redundant-assignments': 'error',
      'sonarjs/no-all-duplicated-branches': 'error',
      'sonarjs/no-identical-functions': 'error',

      // TypeScript & General Best Practices
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'no-debugger': 'error',
      'no-unused-vars': 'off',
      'no-undef': 'off',
    },
  },
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'src/assets/**',
      '*.config.js',
      'coverage/**',
    ],
  },
];
