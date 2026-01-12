# Shell Tools Test Suite

## Overview

This directory contains comprehensive test coverage for the enhanced shell tools functionality implemented in Tasks 4.1, 4.2, and 2.1.

## Test Structure

### Automated Tests

- **`shell-registry.test.ts`** - Core shell registry functionality
  - Shell creation, management, and cleanup
  - Status tracking and lifecycle management
  - Error handling and edge cases

- **`output-limiting.test.ts`** - Output limiting and file management (Task 4.1)
  - Character-based limiting (100k characters)
  - File output to `.vscode-mcp-output/`
  - Silence flag functionality
  - File cleanup and management

- **`safety-warnings.test.ts`** - Safety warnings pattern detection (Task 4.2)
  - **SAFETY-FOCUSED**: Very simple tests only
  - Pattern detection against command strings (no execution)
  - Single test file deletion in controlled environment
  - False positive prevention

- **`interactive-detection.test.ts`** - Interactive prompt detection (Task 2.1)
  - Keyword and regex pattern detection
  - Keyword precedence over regex patterns
  - Shell status auto-switching
  - Integration with timeout strategies

### Manual Testing

- **`manual-testing-guide.md`** - Comprehensive manual testing scenarios
  - Real-world testing scenarios (SvelteKit scaffolding)
  - Integration testing across all features
  - Performance and edge case testing
  - Safety-conscious testing procedures

## Running Tests

### Prerequisites

1. **Rebuild Extension**:
   ```bash
   npm run rebuild-and-reload
   ```

2. **VS Code Setup**:
   - Ensure VS Code has shell integration enabled
   - Open workspace in VS Code
   - No conflicting extensions

### Automated Tests

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- --grep "Shell Registry"
npm test -- --grep "Output Limiting"
npm test -- --grep "Safety Warnings"
npm test -- --grep "Interactive Detection"

# Run with detailed output
npm test -- --verbose
```

### Manual Tests

Follow the detailed scenarios in `manual-testing-guide.md`:

1. **Output Limiting Tests** - Verify character limits and file management
2. **Safety Warnings Tests** - Verify pattern detection (SAFE TESTING ONLY)
3. **Interactive Detection Tests** - Verify prompt detection and shell management
4. **Integration Tests** - Verify all features work together

## Test Philosophy

### Safety First

- **Safety warnings tests are intentionally minimal**
- **No actual destructive commands are executed**
- **Only pattern detection logic is tested**
- **File operations limited to controlled test environment**

### Comprehensive Coverage

- **Unit tests** for individual function logic
- **Integration tests** for feature interaction
- **Manual tests** for real-world scenarios
- **Performance tests** for large output handling
- **Edge case tests** for robustness

### User Experience Focus

- Tests verify not just functionality but usability
- Clear feedback and messaging tested
- Error handling and recovery tested
- Performance impact minimized

## Test Data and Fixtures

### Safe Test Commands

```bash
# Safe commands for testing (no warnings expected)
ls -la
echo "hello world"
mkdir test_dir
cat file.txt
pwd
```

### Pattern Test Strings

```bash
# Destructive patterns (TESTING ONLY - never execute)
"rm -rf /"
"del /s C:\\"
"format c:"

# Interactive patterns
"Continue? (y/n)"
"Enter password:"
"Press any key"
```

### Output Size Tests

```bash
# Generate long output for testing
1..2000 | ForEach-Object { "Line $_ with additional content" }
```

## Contributing to Tests

### Adding New Tests

1. **Identify the feature area** (registry, output, safety, interactive)
2. **Choose appropriate test file** or create new one
3. **Follow safety guidelines** for destructive command testing
4. **Include both positive and negative test cases**
5. **Add manual test scenarios** for complex interactions

### Test Safety Guidelines

1. **Never execute actual destructive commands**
2. **Use only test strings for pattern detection**
3. **Limit file operations to controlled test directories**
4. **Clean up all test artifacts**
5. **Document any potential risks clearly**

### Test Quality Standards

1. **Clear test descriptions** explaining what is being tested
2. **Comprehensive assertions** covering expected behavior
3. **Proper setup and teardown** for test isolation
4. **Error handling tests** for robustness
5. **Performance considerations** for large data sets

## Continuous Integration

These tests are designed to be:

- **Safe to run in CI/CD environments**
- **Fast executing** (most complete in seconds)
- **Deterministic** (consistent results)
- **Self-contained** (no external dependencies)
- **Resource conscious** (minimal system impact)

## Troubleshooting Tests

### Common Issues

1. **Extension not rebuilt**: Run `npm run rebuild-and-reload`
2. **Shell integration missing**: Restart VS Code terminal
3. **File permission errors**: Check test directory permissions
4. **Pattern detection failures**: Verify regex compilation
5. **Performance issues**: Check output size limits

### Debug Information

- Check VS Code Developer Console for detailed logs
- Use `console.log` statements in test code for debugging
- Verify test environment setup before running
- Check file system state after tests complete

---

**Remember**: These tests ensure the shell tools are reliable, safe, and user-friendly while maintaining system security and performance.
