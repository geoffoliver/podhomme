import { defineConfig, globalIgnores } from 'eslint/config';
import nextTs from 'eslint-config-next/typescript';
import nextVitals from 'eslint-config-next/core-web-vitals';
import stylisticJs from '@stylistic/eslint-plugin';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
  {
    plugins: {
      '@stylistic/js': stylisticJs,
    },
    rules: {
      quotes: ['error', 'single'],
      'comma-dangle': ['error', 'always-multiline'],
      '@typescript-eslint/no-explicit-any': 'off',
      semi: ['error', 'always'],
      '@typescript-eslint/ban-ts-comment': 'off',
      'react-hooks/exhaustive-deps': ['error'],
      'sort-imports': ['error', {
        'ignoreCase': false,
        'ignoreDeclarationSort': false,
        'ignoreMemberSort': false,
        'memberSyntaxSortOrder': ['none', 'all', 'multiple', 'single'],
        'allowSeparatedGroups': true,
      }],
      '@stylistic/js/curly-newline': ['error', {
        'multiline': true,
        'minElements': 3,
        'consistent': true,
      }],
      '@stylistic/js/object-curly-newline': ['error', {
        'ObjectExpression': {
          'multiline': true, 'minProperties': 3, 'consistent': true,
        },
        'ObjectPattern': {
          'multiline': true, 'minProperties': 3, 'consistent': true,
        },
        'ImportDeclaration': {
          'multiline': true, 'minProperties': 3, 'consistent': true,
        },
        'ExportDeclaration': {
          'multiline': true, 'minProperties': 3, 'consistent': true,
        },
      }],
    },
  },
]);

export default eslintConfig;
