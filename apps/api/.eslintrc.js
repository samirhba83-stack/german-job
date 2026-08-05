module.exports = {
  extends: [require.resolve('@german-job-engine/config/eslint')],
  parserOptions: {
    project: './tsconfig.json',
    sourceType: 'module',
  },
  overrides: [
    {
      // Casting partial mocks to full interfaces legitimately needs `any` in tests.
      files: ['**/*.spec.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
};
