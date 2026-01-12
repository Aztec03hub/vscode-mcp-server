# Token Counting Tool - Testing Guide

## ✅ Prerequisites Checklist

- [x] `.env` file created with ANTHROPIC_API_KEY
- [x] `dotenv` package installed
- [x] Extension rebuilt with `npm run rebuild-and-reload`
- [ ] **VS Code completely restarted** (CRITICAL!)
- [ ] MCP Server is running (check status bar)

## 🧪 Quick Start Tests (5-30 seconds each)

Before running full test suite, try these quick validation tests:

### Quick Test 1: Simple Text
   ```javascript
count_tokens({
  text: "Hello, world!"
})
```
Expected: ~3-4 tokens

### Quick Test 2: This File
```javascript
  count_tokens({
  filepath: "TOKEN_COUNTING_TESTING_GUIDE.md"
})
```
Expected: Should return token count for this file

### Quick Test 3: Line Range
```javascript
count_tokens({
  filepath: "TOKEN_COUNTING_TESTING_GUIDE.md",
  startLine: 1,
  endLine: 10
})
```
Expected: Should return token count for first 10 lines

---

## 📋 Comprehensive Test Suite

### Test 1: Direct Text Input ✓

**Test Simple Text:**
```javascript
count_tokens({
  text: "Hello, world! This is a test."
})
```

**Expected Output:**
```
**Token Counting Results:**

**Tool Result Details:**
- tokenCount: <number>
- characterCount: 34
- model: claude-sonnet-4-5-20250929
- source: direct_text
```

---

### Test 2: Full File Token Counting ✓

**Test with Test File:**
```javascript
count_tokens({
  filepath: "token-counting-test.md"
})
```

**Expected Output:**
```
**Token Counting Results:**

**Tool Result Details:**
- tokenCount: <number>
- characterCount: <number>
- model: claude-sonnet-4-5-20250929
- source: file
- filepath: token-counting-test.md
```

---

### Test 3: File with Line Range ✓

**Test Lines 1-20:**
```javascript
count_tokens({
  filepath: "token-counting-test.md",
  startLine: 1,
  endLine: 20
})
```

**Expected Output:**
```
**Token Counting Results:**

**Tool Result Details:**
- tokenCount: <number>
- characterCount: <number>
- model: claude-sonnet-4-5-20250929
- source: file_lines
- filepath: token-counting-test.md
- linesProcessed: 1-20
```

---

### Test 4: Different Model ✓

**Test with Claude Opus:**
```javascript
count_tokens({
  text: "Testing with Claude Opus model.",
  model: "claude-opus-4-20250514"
})
```

**Expected Output:**
```
**Token Counting Results:**

**Tool Result Details:**
- tokenCount: <number>
- characterCount: 33
- model: claude-opus-4-20250514
- source: direct_text
```

---

### Test 5: Large File (Warning Test) ✓

**Test with Large Source File:**
```javascript
count_tokens({
  filepath: "src/tools/edit-tools.ts"
})
```

**Expected Output:**
- Should successfully count tokens
- May show warning if file >16MB

---

### Test 6: Multiple Line Ranges ✅ ✨

**Test Multiple Discontinuous Ranges:**
```javascript
count_tokens({
  filepath: "src/tools/file-tools.ts",
  lineRanges: [
    { startLine: 1, endLine: 50, description: "Imports and type definitions" },
    { startLine: 100, endLine: 200, description: "Core file operations" },
    { startLine: 400, endLine: 500, description: "Token counting functions" }
  ]
})
```

**Expected Output:**
```
**Token Counting Results:**

**Tool Result Details:**
- tokenCount: <sum of all ranges>
- characterCount: <sum of all ranges>
- model: claude-sonnet-4-5-20250929
- source: file_multiple_ranges
- filepath: src/tools/file-tools.ts
- rangeCount: 3

**Range Breakdown:**
- Range 1 (lines 1-50): <tokens> tokens, <chars> characters
  Description: Imports and type definitions
- Range 2 (lines 100-200): <tokens> tokens, <chars> characters
  Description: Core file operations
- Range 3 (lines 400-500): <tokens> tokens, <chars> characters
  Description: Token counting functions
```

---

### Test 7: Multiple Ranges Without Descriptions ✅

**Test Multiple Ranges (Minimal):**
```javascript
count_tokens({
  filepath: "CLAUDE.md",
  lineRanges: [
    { startLine: 1, endLine: 10 },
    { startLine: 50, endLine: 60 }
  ]
})
```

**Expected Output:**
```
**Token Counting Results:**

**Tool Result Details:**
- tokenCount: <sum>
- characterCount: <sum>
- model: claude-sonnet-4-5-20250929
- source: file_multiple_ranges
- filepath: CLAUDE.md
- rangeCount: 2

**Range Breakdown:**
- Range 1 (lines 1-10): <tokens> tokens, <chars> characters
- Range 2 (lines 50-60): <tokens> tokens, <chars> characters
```

---

## Error Test Cases

### Error Test 1: Missing API Key ❌

**Remove or unset ANTHROPIC_API_KEY, then:**
```javascript
count_tokens({
  text: "This should fail"
})
```

**Expected Error:**
```
Error: ANTHROPIC_API_KEY environment variable is not set. Please set it to use the token counting feature.
```

---

### Error Test 2: Both text and filepath ❌

```javascript
count_tokens({
  text: "Hello",
  filepath: "test.md"
})
```

**Expected Error:**
```
Error: Cannot provide both "text" and "filepath" parameters. Please use only one.
```

---

### Error Test 3: Neither text nor filepath ❌

```javascript
count_tokens({})
```

**Expected Error:**
```
Error: Either "text" or "filepath" parameter must be provided
```

---

### Error Test 4: Line Range without Filepath ❌

```javascript
count_tokens({
  text: "Hello",
  startLine: 1,
  endLine: 10
})
```

**Expected Error:**
```
Error: Parameters "startLine" and "endLine" can only be used with "filepath"
```

---

### Error Test 5: Invalid Line Range ❌

```javascript
count_tokens({
  filepath: "token-counting-test.md",
  startLine: 100,
  endLine: 50
})
```

**Expected Error:**
```
Error: "startLine" must be <= "endLine"
```

---

### Error Test 6: Both Legacy Range and lineRanges ❌

```javascript
count_tokens({
  filepath: "test.md",
  startLine: 1,
  endLine: 10,
  lineRanges: [{ startLine: 20, endLine: 30 }]
})
```

**Expected Error:**
```
Error: Cannot use both "startLine"/"endLine" and "lineRanges". Please use only one approach.
```

---

### Error Test 7: lineRanges without Filepath ❌

```javascript
count_tokens({
  text: "Hello",
  lineRanges: [{ startLine: 1, endLine: 10 }]
})
```

**Expected Error:**
```
Error: Parameter "lineRanges" can only be used with "filepath"
```

---

### Error Test 8: Empty lineRanges Array ❌

```javascript
count_tokens({
  filepath: "test.md",
  lineRanges: []
})
```

**Expected Error:**
```
Error: "lineRanges" must contain at least one range
```

---

### Error Test 9: Invalid Line Number in lineRanges ❌

```javascript
count_tokens({
  filepath: "test.md",
  lineRanges: [
    { startLine: 0, endLine: 10 }
  ]
})
```

**Expected Error:**
```
Error: lineRanges[0].startLine must be >= 1
```

---

### Error Test 10: Invalid File Path ❌

```javascript
count_tokens({
  filepath: "nonexistent-file.txt"
})
```

**Expected Error:**
```
Error: <file not found error from VS Code>
```

---

## Manual Testing Steps

1. **Open VS Code Output Panel**
   - View → Output
   - Select "MCP Server" from dropdown
   - This shows all logging from the tool

2. **Start MCP Server**
   - Check status bar for MCP server status
   - If not running, use command palette: "Toggle MCP Server"

3. **Run Each Test Case**
   - Use your MCP client to call the `count_tokens` tool
   - Verify output matches expected format
   - Check Output panel for detailed logs

4. **Verify Token Counts**
   - Token counts should be reasonable (roughly 1 token per 4 characters)
   - Compare with Anthropic's web interface if needed

---

## 🔍 Troubleshooting

### Issue: "ANTHROPIC_API_KEY environment variable is not set"

**Solution:**
1. Check the `.env` file exists in workspace root
2. Check the API key is on the line starting with `ANTHROPIC_API_KEY=`
3. **Completely restart VS Code** (close all windows, reopen)
4. Check the Output panel (View → Output → "MCP Server") for loading confirmation
5. Alternative: Verify env var is set: `echo $env:ANTHROPIC_API_KEY` (PowerShell)

### Issue: Tool not found

**Solution:**
1. Verify extension is installed: Check Extensions panel
2. Rebuild: `npm run rebuild-and-reload`
3. **Restart VS Code completely**
4. Check MCP server is running (status bar should show server status)
5. Try toggling the MCP Server off and on again

### Issue: Unexpected token counts

**Solution:**
1. Check which model is being used
2. Different models may tokenize slightly differently
3. Compare with Anthropic's official tokenizer if available

### Issue: API errors

**Solution:**
1. Verify API key is valid
2. Check internet connection
3. Review error message in Output panel
4. Ensure model name is correct

---

## Success Criteria

✅ All basic test cases pass
✅ Error handling works correctly  
✅ File size validation works
✅ Line range support works
✅ Multiple models supported
✅ Output format is correct
✅ Logging is comprehensive

---

## Next Steps After Testing

1. Document any issues found
2. Consider adding automated tests
3. Update user documentation
4. Consider additional features:
   - Batch token counting
   - Token count caching
   - Support for images/PDFs
   - Cost estimation based on token count