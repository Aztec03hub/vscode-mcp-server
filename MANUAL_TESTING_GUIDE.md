# Manual Integration Testing Guide

## Quick Start Commands

```bash
# 1. Set up test files
cd C:\Users\plafayette\workspace\github_projects\vscode-mcp-server
node out/test/integration-test-runner.js setup

# 2. Get test scenarios with MCP commands
node out/test/integration-test-runner.js scenarios

# 3. Create performance test
node out/test/integration-test-runner.js performance

# 4. Clean up when done
node out/test/integration-test-runner.js cleanup
```

## Test Scenarios to Try

### Test 1: Simple Single Diff ✨
**File:** `integration-test-files/simple.ts`
**What it tests:** Basic exact content matching

**MCP Command:**
```json
{
  "tool": "apply_diff",
  "arguments": {
    "filePath": "integration-test-files/simple.ts",
    "diffs": [{
      "startLine": 1,
      "endLine": 1,
      "originalContent": "    private result: number = 0;",
      "newContent": "    private result: number = 100;",
      "description": "Change initial value to 100"
    }],
    "description": "Update Calculator initial value"
  }
}
```

**Expected Result:** 
- VS Code diff viewer should open
- Shows change from `= 0;` to `= 100;`
- User approval dialog appears
- If approved, change applies successfully

### Test 2: Multiple Diffs in One Operation 🔄
**File:** `integration-test-files/simple.ts` (reset first)
**What it tests:** Multiple non-overlapping changes

**MCP Command:**
```json
{
  "tool": "apply_diff",
  "arguments": {
    "filePath": "integration-test-files/simple.ts",
    "diffs": [
      {
        "startLine": 1,
        "endLine": 1,
        "originalContent": "    private result: number = 0;",
        "newContent": "    private result: number = 50;",
        "description": "Set initial value to 50"
      },
      {
        "startLine": 7,
        "endLine": 9,
        "originalContent": "    getResult(): number {\n        return this.result;\n    }",
        "newContent": "    getResult(): number {\n        console.log(\"Current result:\", this.result);\n        return this.result;\n    }",
        "description": "Add logging to getResult"
      }
    ],
    "description": "Update initial value and add logging"
  }
}
```

**Expected Result:**
- Diff shows both changes in one view
- Initial value changes to 50
- Logging added to getResult method
- All changes apply atomically

### Test 3: Fuzzy Whitespace Matching 🎯
**File:** `integration-test-files/whitespace.js`
**What it tests:** Handling of whitespace differences

**MCP Command:**
```json
{
  "tool": "apply_diff",
  "arguments": {
    "filePath": "integration-test-files/whitespace.js",
    "diffs": [{
      "startLine": 0,
      "endLine": 4,
      "originalContent": "function processData(input) {\n    console.log(\"Processing\");\n    const result = input * 2;\n    return result;\n}",
      "newContent": "function processData(input) {\n    console.log(\"Processing enhanced data\");\n    const result = input * 3;\n    console.log(\"Result:\", result);\n    return result;\n}",
      "description": "Enhance processData function"
    }],
    "description": "Update function with enhanced logging"
  }
}
```

**Expected Result:**
- Should find content despite whitespace differences
- Shows warning about fuzzy matching
- Updates message and multiplier
- Adds new logging line

### Test 4: Overlapping Conflict (Should Fail) ❌
**File:** `integration-test-files/simple.ts`
**What it tests:** Conflict detection

**MCP Command:**
```json
{
  "tool": "apply_diff",
  "arguments": {
    "filePath": "integration-test-files/simple.ts",
    "diffs": [
      {
        "startLine": 3,
        "endLine": 5,
        "originalContent": "    add(value: number): void {\n        this.result += value;\n    }",
        "newContent": "    add(value: number): void {\n        this.result += value * 2;\n    }",
        "description": "Double the added value"
      },
      {
        "startLine": 4,
        "endLine": 4,
        "originalContent": "        this.result += value;",
        "newContent": "        this.result += value * 3;",
        "description": "Triple the added value"
      }
    ],
    "description": "Conflicting changes to add method"
  }
}
```

**Expected Result:**
- Should fail with overlap detection error
- Error message explains the conflict
- No changes applied
- Suggests how to fix

### Test 5: Content Not Found (Should Fail) ❌
**File:** `integration-test-files/simple.ts`
**What it tests:** Handling of non-existent content

**MCP Command:**
```json
{
  "tool": "apply_diff",
  "arguments": {
    "filePath": "integration-test-files/simple.ts",
    "diffs": [{
      "startLine": 5,
      "endLine": 7,
      "originalContent": "    nonExistentMethod(): void {\n        // This does not exist\n    }",
      "newContent": "    newMethod(): void {\n        // This is new\n    }",
      "description": "Replace non-existent method"
    }],
    "description": "Try to replace non-existent content"
  }
}
```

**Expected Result:**
- Should fail with "content not found" error
- Helpful error message with suggestions
- No changes applied

## Step-by-Step Testing Process

### 1. Setup
- Ensure VS Code is open with the test files
- Ensure MCP server is running and connected
- Have your MCP client ready

### 2. Test Each Scenario
For each test:
1. **Copy the MCP command** from above
2. **Send it through your MCP client**
3. **Verify the expected behavior**
4. **Check VS Code** for diff viewer and dialogs
5. **Reset the file** if needed before next test

### 3. What to Verify
- ✅ **Diff Preview**: VS Code diff viewer opens with correct changes
- ✅ **User Dialog**: Approval dialog appears with warnings (if any)
- ✅ **Change Application**: Changes apply correctly when approved
- ✅ **Error Handling**: Failed tests show helpful error messages
- ✅ **File State**: Files are properly modified or left unchanged

### 4. Performance Test
Create a large file test:

```bash
node out/test/integration-test-runner.js performance
```

Then test with the generated large file to verify performance.

## Troubleshooting

**If tests fail:**
1. **Check file paths** - Ensure you're using the correct relative paths
2. **Verify MCP connection** - Make sure server is running
3. **Check VS Code** - Extension should be loaded and active
4. **Reset test files** - Run setup again if files are modified

**Common issues:**
- File path should be relative to workspace root
- Content must match exactly (including whitespace for exact matches)
- Line numbers are 0-based

## Success Indicators

You'll know it's working when:
- ✅ VS Code diff viewer opens for each test
- ✅ User approval dialogs appear
- ✅ Valid changes apply successfully  
- ✅ Invalid changes are rejected with helpful errors
- ✅ Fuzzy matching works for whitespace differences
- ✅ Conflicts are detected and prevented

**Happy Testing!** 🚀
