import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import sonarjs from 'eslint-plugin-sonarjs';
import unicorn from 'eslint-plugin-unicorn';
import htmlPlugin from '@html-eslint/eslint-plugin';
import htmlParser from '@html-eslint/parser';

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
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
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
      unicorn,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,

      // SonarQube TypeScript & Code Quality Rules
      'sonarjs/cognitive-complexity': ['error', 15],
      'sonarjs/regex-complexity': 'off', // Specialized multi-token tax & entity regexes
      'sonarjs/prefer-regexp-exec': 'off', // Allow string.match for regex extraction
      'sonarjs/no-duplicate-string': 'off', // Tax codes, schema keys, and token names legitimately repeat
      'sonarjs/table-header-reference': 'off', // Custom Web Component shadow/light DOM tables
      'sonarjs/table-header': 'off',
      'sonarjs/link-with-target-blank': 'warn',
      'sonarjs/slow-regex': 'error',
      'sonarjs/redundant-type-aliases': 'error',
      'sonarjs/prefer-type-guard': 'error',
      'sonarjs/no-useless-intersection': 'error',
      'sonarjs/no-redundant-assignments': 'error',
      'sonarjs/no-all-duplicated-branches': 'error',
      'sonarjs/no-identical-functions': 'error',

      // DOM & Modern JavaScript Best Practices
      'unicorn/prefer-dom-node-dataset': 'error',
      'unicorn/prefer-dom-node-append': 'error',
      'unicorn/prefer-dom-node-remove': 'error',
      'unicorn/prefer-modern-dom-apis': 'error',
      'unicorn/prefer-number-properties': 'error', // S7773: prefer Number.parseFloat / Number.parseInt
      'unicorn/consistent-function-scoping': 'error', // SonarQube typescript:S7721 - Functions should be moved to the highest possible scope

      // TypeScript & General Best Practices (including SonarQube S6671)
      'prefer-promise-reject-errors': 'error', // SonarQube typescript:S6671 - Expected Promise rejection reason to be an Error
      '@typescript-eslint/prefer-promise-reject-errors': 'error',
      'no-await-in-loop': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
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
    files: ['src/lib/extractor.ts'],
    rules: {
      'sonarjs/slow-regex': 'off', // Complex spatial multi-token regex patterns for OCR/PDF text extraction
    },
  },
  {
    files: ['**/*.html'],
    plugins: {
      '@html-eslint': htmlPlugin,
    },
    languageOptions: {
      parser: htmlParser,
    },
    rules: {
      '@html-eslint/require-input-label': 'error', // Maps to SonarQube Web:InputWithoutLabelCheck
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
