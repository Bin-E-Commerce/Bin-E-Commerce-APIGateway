// Cấu hình Jest riêng cho API Gateway để test controller TypeScript mà không khởi động toàn bộ gateway.

module.exports = {
    moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: '.',
    testRegex: '.*\\.spec\\.ts$',
    transform: {
        '^.+\\.(t|j)s$': 'ts-jest',
    },
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@common/(.*)$': '<rootDir>/../../packages/common/$1',
    },
    testEnvironment: 'node',
};
