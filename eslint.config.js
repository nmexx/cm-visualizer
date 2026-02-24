'use strict';

const js = require('@eslint/js');

module.exports = [
  // Base recommended rules for all JS files
  {
    ...js.configs.recommended,
    // Target main-process and lib files
    files: ['main.js', 'preload.js', 'lib/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        // Node.js globals
        require: 'readonly',
        module:  'readonly',
        exports: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        process: 'readonly',
        console: 'readonly',
        Buffer:  'readonly',
        // Electron globals (available in main process)
        Electron: 'readonly',
      },
    },
    rules: {
      // ── Possible errors ────────────────────────────────────────────────────
      'no-unused-vars':    ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console':         'off',          // we use console for logging
      'no-undef':           'error',

      // ── Best practices ─────────────────────────────────────────────────────
      'eqeqeq':            ['error', 'always'],
      'curly':              'error',
      'no-var':             'error',
      'prefer-const':      'warn',
      'no-duplicate-imports': 'error',

      // ── Style (keep it light for a solo project) ───────────────────────────
      'semi':              ['warn', 'always'],
      'no-trailing-spaces': 'warn',
      'no-multiple-empty-lines': ['warn', { max: 2 }],
    },
  },
  // Test files — relax some rules and add jest globals
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        require:   'readonly',
        module:    'readonly',
        exports:   'readonly',
        __dirname: 'readonly',
        __filename:'readonly',
        process:   'readonly',
        console:   'readonly',
        // Jest globals
        describe:  'readonly',
        test:      'readonly',
        it:        'readonly',
        expect:    'readonly',
        beforeEach:'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll:  'readonly',
        jest:      'readonly',
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-undef':       'error',
      'prefer-const':  'warn',
      'semi':          ['warn', 'always'],
    },
  },
  // Global ignores
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'Data/**',
    ],
  },
];
