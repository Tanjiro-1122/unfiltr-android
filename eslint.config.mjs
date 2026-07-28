import expoConfig from 'eslint-config-expo/flat.js';
import prettierConfig from 'eslint-config-prettier';

export default [
  ...expoConfig,
  prettierConfig,
  {
    ignores: [
      '.expo/**',
      'node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      '**/*.test.ts',
      '**/*.test.tsx',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'import/order': [
        'warn',
        {
          alphabetize: { order: 'asc', caseInsensitive: true },
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index']],
          'newlines-between': 'always',
        },
      ],
    },
  },
  {
    files: ['src/features/chat/ChatScreen.tsx'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^(?:_|ScrollView)$' },
      ],
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    files: ['src/features/admin/AdminDashboardScreen.tsx'],
    rules: {
      'import/order': 'off',
    },
  },
];
