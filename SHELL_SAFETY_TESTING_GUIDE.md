# Shell Safety Testing Guide (Task 1.4)

## Overview
This guide provides step-by-step instructions for testing the shell command safety system implemented in Tasks 1.2 and 1.3.

## Prerequisites
1. Ensure the extension is properly built and installed:
   ```bash
   npm run rebuild-and-reload
   ```
2. Reload VS Code window if needed (`Ctrl+Shift+P` → "Developer: Reload Window")
3. Verify status bar items are visible:
   - MCP Server status
   - Apply Diff Auto-Approve status
   - Shell Auto-Approve status (new)

## Test Scenarios

### Test 1: Verify Safety Detection (Shell Auto-Approval OFF)

1. **Ensure Shell Auto-Approval is OFF**:
   - Check status bar shows: `$(shield) Shell Auto-Approve: OFF`
   - If ON, click to toggle it OFF

2. **Create a test file**:
   ```bash
   echo "test" > test-file.txt
   ```

3. **Attempt to delete the file**:
   ```bash
   rm test-file.txt
   ```

4. **Expected behavior**:
   - ⚠️ Warning notification appears: "Dangerous command detected: rm test-file.txt"
   - Two status bar buttons appear on the right:
     - `$(check) Accept` (green background)
     - `$(x) Reject` (red background)
   - Command execution is paused

5. **Test REJECT flow**:
   - Click the red `$(x) Reject` button
   - Expected: Command is cancelled, file remains
   - Verify with: `ls test-file.txt`

6. **Test ACCEPT flow**:
   - Run `rm test-file.txt` again
   - Click the green `$(check) Accept` button
   - Expected: File is deleted
   - Verify with: `ls test-file.txt` (should show error)

### Test 2: Timeout Auto-Rejection

1. **Create another test file**:
   ```bash
   echo "test2" > test-file2.txt
   ```

2. **Trigger approval dialog**:
   ```bash
   rm test-file2.txt
   ```

3. **Wait 30 seconds without clicking**

4. **Expected behavior**:
   - After 30 seconds, buttons disappear
   - Command is auto-rejected
   - File remains undeleted
   - Output shows: "Command cancelled by user"

### Test 3: Shell Auto-Approval Mode

1. **Enable Shell Auto-Approval**:
   - Click status bar: `$(shield) Shell Auto-Approve: OFF`
   - **STRONG WARNING DIALOG** appears
   - Click "I Understand - Keep Enabled"
   - Status bar changes to RED: `$(shield) Shell Auto-Approve: ON`

2. **Create test file**:
   ```bash
   echo "test3" > test-file3.txt
   ```

3. **Delete without approval**:
   ```bash
   rm test-file3.txt
   ```

4. **Expected behavior**:
   - NO approval buttons appear
   - Command executes immediately
   - Warning still shown in output
   - File is deleted

5. **Disable auto-approval**:
   - Click the RED status bar item
   - Verify it returns to normal

### Test 4: Safe Commands (No Approval Needed)

1. **Run safe commands**:
   ```bash
   echo "hello"
   ls
   pwd
   ```

2. **Expected behavior**:
   - Commands execute normally
   - No approval buttons appear
   - No warnings shown

### Test 5: Other Destructive Patterns

1. **Test various patterns**:
   ```bash
   # Create test files first
   echo "test" > test-rf.txt
   mkdir test-dir
   echo "test" > test-dir/file.txt
   
   # Test patterns (each should trigger approval)
   rm -rf test-dir
   rm -f test-rf.txt
   ```

2. **Expected**: Each command triggers approval flow

## Console Output Verification

To see detailed logs:
1. Open Command Palette: `Ctrl+Shift+P`
2. Run: "Developer: Show Logs"
3. Select: "Extension Host"

Look for:
- `[Shell Tools] Destructive command pattern detected`
- `[Shell Tools] Requesting user approval`
- `[ShellApprovalManager] Showing approval buttons`
- `[ShellApprovalManager] Command approved/rejected`

## Troubleshooting

### Approval buttons don't appear:
1. Check extension is activated (status bars visible)
2. Reload VS Code window
3. Check Extension Host logs for errors
4. Verify shell auto-approval is OFF

### Old behavior (blocking instead of buttons):
1. Extension may not be reloaded properly
2. Run: `npm run rebuild-and-reload`
3. Manually reload VS Code window
4. Check extension version in Extensions panel

## Safety Notes

⚠️ **IMPORTANT**: 
- Only test with files you create specifically for testing
- Never test with system files or important data
- The test command `rm test-file.txt` is the ONLY approved test command
- Always verify auto-approval is disabled after testing

## Success Criteria

✅ All tests pass when:
1. Dangerous commands show approval buttons
2. Accept button executes the command
3. Reject button cancels the command
4. 30-second timeout auto-rejects
5. Shell auto-approval bypasses buttons when enabled
6. Safe commands execute without approval
7. All destructive patterns are detected

## Test Completion

After all tests pass:
1. Ensure shell auto-approval is OFF
2. Clean up any remaining test files
3. Update `ux-improvements-plan.md` Task 1.4 status to ✅ COMPLETED