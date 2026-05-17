import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

const customConfig: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  globalSetup: '<rootDir>/jest.globalSetup.js',
  maxWorkers: 1,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};

// nextJest appends transformIgnorePatterns after its own '/node_modules/' entry, so
// user config can't override it. Post-process the resolved config to let @prisma through
// (Prisma v7 ships an ESM .mjs WASM loader that Jest's CJS environment can't parse otherwise).
export default async () => {
  const config = await (createJestConfig(customConfig) as () => Promise<Config>)();
  config.transformIgnorePatterns = [
    '/node_modules/(?!@prisma/)',
    '^.+\\.module\\.(css|sass|scss)$',
  ];
  return config;
};
