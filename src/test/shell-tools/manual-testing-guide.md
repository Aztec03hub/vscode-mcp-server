# Manual Testing Guide - Shell Tools Features

## Overview

This guide provides comprehensive manual testing scenarios for the enhanced shell tools functionality, including output limiting, safety warnings, and interactive pattern detection.

**⚠️ SAFETY NOTICE**: When testing safety warnings, use only the safe test scenarios provided. Never execute actual destructive commands.

---

## 🚀 Pre-Testing Setup

### 1. Extension Installation
```bash
# Rebuild and reload the extension before testing
npm run rebuild-and-reload
```

### 2. VS Code Preparation
- Open the vscode-mcp-server project in VS Code
- Ensure no other MCP extensions are conflicting
- Open VS Code terminal for command execution
- Check that shell integration is working (shell name appears in terminal)

### 3. Test Environment
- Create a test directory for safe operations:
```bash
mkdir shell-tools-manual-tests
cd shell-tools-manual-tests
```

---

## 📋 Task 4.1: Output Limiting Tests

### Test 1: Character Limit with Normal Mode
**Objective**: Verify 100k character limit and file output

**Steps**:
1. Execute command that generates long output:
   ```bash
   # Windows PowerShell
   1..2000 | ForEach-Object { "This is line $_ with some additional text to make it longer" }
   
   # Unix/Linux
   for i in {1..2000}; do echo "This is line $i with some additional text to make it longer"; done
   ```

2. **Expected Results**:
   - Output should be truncated at 200,000 characters
   - Message: "Output too long, truncated to 200,000 characters"
   - File reference: "Full output saved to file: shell-X-output.txt"
   - `.vscode-mcp-output/` directory should be created
   - Output file should contain full output

### Test 2: Character Limit with Silence Mode
**Objective**: Verify silenceOutput flag behavior

**Steps**:
1. Use `execute_shell_command_code` with `silenceOutput: true`
2. Execute the same long output command

**Expected Results**:
- Display: "Command completed, full output saved to file <shell-X-output.txt>"
- No truncated output shown
- Full output saved to file

### Test 3: Short Output with Silence Mode
**Objective**: Verify silence mode with output under limit

**Steps**:
1. Execute short command with `silenceOutput: true`:
   ```bash
   echo "Short test output"
   ```

**Expected Results**:
- Display: "Command completed, full output saved to file <shell-X-output.txt>"
- File still created with short output

### Test 4: Output File Management
**Objective**: Verify file overwriting and cleanup

**Steps**:
1. Execute long command twice in same shell
2. Check that output file is overwritten
3. Close shell using shell registry
4. Verify output file is cleaned up

**Expected Results**:
- Second execution overwrites first file
- File cleanup occurs on shell closure

---

## 🛡️ Task 4.2: Safety Warnings Tests

**⚠️ CRITICAL SAFETY NOTE**: These tests only verify warning detection. DO NOT execute actual destructive commands.

### Test 1: Warning Detection (Pattern Testing Only)
**Objective**: Verify destructive command detection

**Safe Test Commands** (only test detection, don't execute):
```bash
# Test these command STRINGS for warning detection:
# (Enter them to see warnings, then cancel before execution)

# Windows patterns
del /s C:\temp
format D:
rmdir /s /q temp_folder
rd /s old_directory

# Unix/Linux patterns  
rm -rf /tmp/test
mkfs /dev/sdb1
dd if=/dev/zero of=/dev/sdb
fdisk /dev/sdb
```

**Expected Results**:
- Each command should trigger safety warning
- Warning should appear prominently in output
- Warning should include ⚠️ emoji and clear message
- Commands should still execute (warnings don't block)

### Test 2: Safe Command Verification
**Objective**: Verify safe commands don't trigger warnings

**Safe Commands**:
```bash
ls -la
dir
cat file.txt
type file.txt
echo "hello world"
mkdir new_folder
cd new_folder
pwd
```

**Expected Results**:
- No safety warnings should appear
- Normal command execution

### Test 3: False Positive Prevention
**Objective**: Verify patterns don't over-match

**Test Commands**:
```bash
echo "rm -rf is dangerous"
cat format_instructions.txt
mkdir del_backup
echo "This mentions format but is safe"
```

**Expected Results**:
- No safety warnings (these are safe despite containing keywords)

---

## 🎯 Task 2.1: Interactive Pattern Detection Tests

### Test 1: SvelteKit Scaffolding (Full Interactive Test)
**Objective**: Test real-world interactive command scenario

**Steps**:
1. Execute interactive scaffolding command:
   ```bash
   npm create svelte@latest test-project
   ```

2. **Expected Behavior**:
   - Command starts normally
   - When interactive prompts appear, shell status should switch to "waiting-for-input"
   - Interactive detection message should appear
   - 💬 emoji notification about using `send_input_to_shell`

3. **Respond to Prompts**:
   ```bash
   # Use send_input_to_shell tool to respond:
   # - Project name: test-project
   # - Template: skeleton
   # - TypeScript: yes
   # etc.
   ```

### Test 2: Keyword Detection Priority
**Objective**: Verify keywords take precedence over regex

**Test Commands**:
```bash
# Simulate interactive outputs (you can echo these to test detection)
echo "Enter your password:"
echo "Continue? (y/n)"
echo "Are you sure you want to proceed?"
echo "Press any key to continue..."
```

**Expected Results**:
- Each should trigger interactive detection
- Shell status should switch to "waiting-for-input"
- Keyword matches should be logged before regex matches

### Test 3: Multi-Shell Interactive Management
**Objective**: Test interactive detection across multiple shells

**Steps**:
1. Create 3 shells using different `shellId` parameters
2. Start interactive commands in each shell
3. Verify independent status tracking
4. Use `list_active_shells` to verify statuses

**Expected Results**:
- Each shell independently tracks interactive state
- `list_active_shells` shows correct status for each
- `send_input_to_shell` works with specific shell IDs

### Test 4: Pattern Edge Cases
**Objective**: Test edge cases in pattern detection

**Test Scenarios**:
```bash
# Test various prompt formats
echo "?"                          # Single question mark
echo "password:"                  # Just keyword
echo "   Continue?   "            # Whitespace
echo "PRESS ANY KEY"              # All caps
echo "Confirm (yes/no):"          # Multiple patterns
```

**Expected Results**:
- All should trigger interactive detection
- Case variations should be handled
- Whitespace should not interfere

---

## 🔄 Integration Tests

### Test 1: Combined Features
**Objective**: Test all features working together

**Steps**:
1. Execute interactive command with long output and safety warnings:
   ```bash
   # This would be a hypothetical command that:
   # - Generates long output (triggers limiting)
   # - Has interactive prompts (triggers detection) 
   # - Contains warning patterns (triggers safety)
   ```

**Expected Results**:
- Safety warning appears first
- Interactive detection works during execution
- Output limiting applies to final result
- All features work without conflicts

### Test 2: Background Process Handling
**Objective**: Test features with background processes

**Steps**:
1. Start background process (e.g., `npm run dev`)
2. Verify output limiting doesn't interfere
3. Test interactive detection in background mode

### Test 3: Shell Lifecycle Integration
**Objective**: Test features during shell lifecycle

**Steps**:
1. Create shell, execute commands with all features
2. Let shell auto-cleanup after 5 minutes
3. Verify output files are cleaned up
4. Verify no memory leaks or zombie processes

---

## 📊 Performance Tests

### Test 1: Large Output Performance
**Objective**: Verify performance with very large output

**Steps**:
1. Generate extremely large output (500k+ characters)
2. Measure processing time
3. Check memory usage

**Expected Results**:
- Processing should complete in reasonable time (<5 seconds)
- Memory usage should not spike significantly
- File operations should not block UI

### Test 2: Pattern Detection Performance
**Objective**: Verify pattern detection doesn't slow execution

**Steps**:
1. Execute many commands with various outputs
2. Compare execution times with/without pattern detection

**Expected Results**:
- Minimal performance impact (<100ms additional)
- No noticeable delay in command execution

---

## ✅ Success Criteria Checklist

### Output Limiting (Task 4.1)
- [ ] Character limit (100k) properly enforced
- [ ] Files saved to `.vscode-mcp-output/` directory
- [ ] Silence flag works correctly
- [ ] File overwriting works
- [ ] File cleanup on shell closure works
- [ ] Proper error handling for file operations

### Safety Warnings (Task 4.2)
- [ ] Destructive commands detected correctly
- [ ] Safe commands don't trigger warnings
- [ ] No false positives
- [ ] Warning display is prominent and clear
- [ ] Commands are not blocked (warning only)

### Interactive Pattern Detection (Task 2.1)
- [ ] Keywords detected with precedence over regex
- [ ] Regex patterns detected correctly
- [ ] Shell status auto-switches to "waiting-for-input"
- [ ] Visual feedback is clear and helpful
- [ ] Integration with `send_input_to_shell` works
- [ ] Multi-shell management works correctly

### Integration
- [ ] All features work together without conflicts
- [ ] Performance is acceptable
- [ ] No memory leaks or resource issues
- [ ] Error handling is robust
- [ ] User experience is smooth and intuitive

---

## 🐛 Troubleshooting

### Common Issues

**Output files not created**:
- Check workspace folder permissions
- Verify `.vscode-mcp-output` directory creation
- Check console for file system errors

**Interactive detection not working**:
- Verify shell integration is active
- Check console logs for pattern matches
- Ensure command output contains detectable patterns

**Safety warnings not appearing**:
- Check command matches defined patterns exactly
- Verify console logging shows pattern detection
- Ensure warning display logic is working

**Performance issues**:
- Monitor output size and processing time
- Check for memory leaks with large outputs
- Verify file operations are not blocking

---

## 📝 Test Results Documentation

When conducting manual tests, document:

1. **Test Environment**:
   - VS Code version
   - Operating system
   - Shell type (PowerShell, bash, etc.)

2. **Feature Test Results**:
   - Which tests passed/failed
   - Any unexpected behavior
   - Performance observations

3. **Issues Found**:
   - Description of issue
   - Steps to reproduce
   - Expected vs actual behavior
   - Severity and impact

4. **Overall Assessment**:
   - Feature completeness
   - User experience quality
   - Performance acceptability
   - Readiness for production use

---

**Remember**: The goal is to ensure all shell tools features work reliably, safely, and provide a great user experience while maintaining system security and performance.
