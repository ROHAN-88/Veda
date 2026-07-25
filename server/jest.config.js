/** Unit-test config (colocated *.spec.ts under src/). */
/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }],
  },
  testEnvironment: 'node',
  collectCoverageFrom: ['**/*.ts', '!**/generated/**', '!main.ts'],
  coverageDirectory: '../coverage',
};
