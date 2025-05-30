# Testing Guide for Apply Diff Tool

## Overview

This guide describes the comprehensive test suite created for the enhanced apply_diff tool. The tests ensure reliability, performance, and backward compatibility of all new features.

## Test Structure

### Unit Tests

1. **ValidationHierarchy Tests** (`validation-hierarchy.test.ts`)
   - Tests all three validation levels (strict, permissive, fuzzy)
   - Verifies early termination for performance
   - Tests line hint disambiguation
   - Validates error handling

2. **StructuralValidator Tests** (`structural-validator.test.ts`)
   - Tests delimiter balance detection (braces, parentheses, brackets)
   - Validates quote and comment handling
   - Tests JSON structure validation
   - Ensures warnings don't block changes

3. **Cache and Performance Tests** (`cache-performance.test.ts`)
   - Validates file content caching
   - Tests partial success mode
   - Measures early termination performance
   - Tests performance tracking with StructuredLogger

### Integration Tests

4. **Backward Compatibility Tests** (`backward-compatibility.test.ts`)
   - Ensures old parameter names (originalContent/newContent) still work
   - Tests mixed parameter usage
   - Validates existing behavior preservation
   - Tests error handling consistency

5. **Edge Cases Tests** (`edge-cases.test.ts`)
   - Empty file handling
   - Single line files
   - Files without trailing newlines
   - Very long lines (1000+ characters)
   - Unicode and special characters
   - Different line endings (CRLF vs LF)

6. **Full Workflow Tests** (`integration.test.ts`)
   - Complete TypeScript refactoring scenarios
   - JSON configuration updates
   - Multi-file refactoring workflows
   - Error recovery with partial success

## Running Tests

### Prerequisites
```bash
npm install
npm run compile
```

### Run All Tests
```bash
npm test
```

### Run Specific Test Suite
```bash
npm test -- --grep "ValidationHierarchy Tests"
```

### Debug Tests in VS Code
1. Open the test file in VS Code
2. Set breakpoints as needed
3. Press F5 to start debugging
4. Select "Extension Tests" configuration

## Test Patterns

### File Operations
```typescript
// Create test file
await vscode.workspace.fs.writeFile(testFileUri, Buffer.from(content));

// Read and verify
const result = await vscode.workspace.fs.readFile(testFileUri);
const text = Buffer.from(result).toString('utf8');
```

### Command Execution
```typescript
await vscode.commands.executeCommand('mcp.applyDiff', {
    filePath: 'test.ts',
    diffs: [{ /* diff config */ }]
});
```

### Error Testing
```typescript
try {
    await vscode.commands.executeCommand('mcp.applyDiff', { /* ... */ });
    assert.fail('Should have thrown error');
} catch (error) {
    assert.ok(error instanceof Error);
    assert.ok(error.message.includes('expected text'));
}
```

## Coverage Areas

### Validation Strategies
- ✅ Exact match at hint
- ✅ Exact match with radius search
- ✅ Whitespace normalization
- ✅ Case-insensitive matching
- ✅ Similarity matching (70%, 80%, 90%)
- ✅ Contextual matching

### Performance Features
- ✅ File content caching (5-second TTL)
- ✅ Early termination (95% confidence)
- ✅ Partial success mode
- ✅ Performance metrics tracking

### Error Handling
- ✅ Progressive error disclosure
- ✅ Diagnostic information
- ✅ Match confidence reporting
- ✅ Structural warnings

### Edge Cases
- ✅ Empty files
- ✅ Large files
- ✅ Unicode content
- ✅ Special characters
- ✅ Line ending variations
- ✅ Concurrent operations

## Best Practices

1. **Isolation**: Each test should be independent and not rely on other tests
2. **Cleanup**: Always clean up test files in `after()` hooks
3. **Assertions**: Use clear, descriptive assertion messages
4. **Performance**: Keep individual tests under 10 seconds
5. **Naming**: Use descriptive test names that explain what is being tested

## Troubleshooting

### Common Issues

1. **Timeout Errors**
   - Increase timeout in Mocha configuration
   - Check for async operations not being awaited

2. **File Access Errors**
   - Ensure test files are cleaned up properly
   - Check file permissions

3. **Command Not Found**
   - Verify extension is activated
   - Check command registration in extension.ts

## Future Improvements

1. **Code Coverage**: Add nyc for code coverage reporting
2. **Performance Benchmarks**: Create dedicated performance test suite
3. **Stress Testing**: Add tests with very large files (10MB+)
4. **Concurrent Testing**: More comprehensive concurrent operation tests
5. **Language-Specific Tests**: Add tests for more file types (Python, Java, etc.)