// backend/jest.config.js
module.exports = {
    // Environnement Node.js (pas de DOM)
    testEnvironment: 'node',
  
    // Fichiers à exécuter avant les tests
    setupFilesAfterEnv: ['./jest.setup.js'],
  
    // Dossiers à ignorer
    testPathIgnorePatterns: [
      '/node_modules/',
      '/prisma/',
      '/dist/'
    ],
  
    // Extensions de fichiers à tester
    moduleFileExtensions: ['js', 'json'],
  
    // Mapping des alias d'import (si vous en utilisez)
    moduleNameMapper: {
      '^@/(.*)$': '<rootDir>/src/$1'
    },
  
    // Timeout des tests (10s)
    testTimeout: 10000,
  
    // Couverture de code
    collectCoverage: true,
    coverageDirectory: './coverage',
    collectCoverageFrom: [
      'src/**/*.js',
      '!src/**/*.test.js',
      '!src/database/**'
    ]
  };