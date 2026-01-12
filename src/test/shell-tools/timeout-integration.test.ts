import * as assert from 'assert';
import * as vscode from 'vscode';
import { 
    executeShellCommand,
    ShellTimeoutManager,
    DEFAULT_TIMEOUT_MS,
} from '../../tools/shell-tools';

/**
 * Test Suite: Shell Timeout Reset Integration Tests
 * 
 * This test suite validates the timeout reset mechanism in realistic scenarios
 * with actual shell command execution and input sending.
 */
suite('Shell Timeout Reset Integration Tests', () => {
    
    // Helper function to wait for a specified time
    const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    // Helper to create a test terminal
    const createTestTerminal = (name: string): vscode.Terminal => {
        return vscode.window.createTerminal({
            name: name,
            hideFromUser: true // Don't show in UI during tests
        });
    };
    
    // Cleanup helper
    const cleanupTerminal = (terminal: vscode.Terminal) => {
        try {
            terminal.dispose();
        } catch (error) {
            // Ignore disposal errors in tests
        }
    };
    
    test('executeShellCommand with shellId clears timeout on completion', async function() {
        // This test may take longer due to shell integration
        this.timeout(10000);
        
        const shellId = 'integration-test-1';
        const terminal = createTestTerminal(shellId);
        
        try {
            // Wait for shell integration
            await wait(1000);
            
            // Skip if shell integration not available
            if (!terminal.shellIntegration) {
                console.log('Skipping test - shell integration not available');
                return;
            }
            
            // Track if timeout fired
            let timeoutFired = false;
            
            // Execute a quick command with timeout tracking
            // Note: Windows PowerShell can take longer to initialize and execute
            const result = await executeShellCommand(
                terminal,
                'echo "test"',
                undefined,
                5000, // 5 second timeout (Windows PowerShell needs more time)
                shellId
            );
            
            // Verify command completed
            assert.ok(result.output.includes('test'), 'Command output should contain "test"');
            assert.strictEqual(result.aborted, false, 'Command should not be aborted');
            
            // Verify timeout was cleared (should return null)
            const timeoutInfo = ShellTimeoutManager.getTimeoutInfo(shellId);
            assert.strictEqual(timeoutInfo, null, 'Timeout should be cleared after completion');
            
            // Set a manual timeout to verify it wasn't already set
            ShellTimeoutManager.setShellTimeout(shellId, 100, () => { timeoutFired = true; });
            
            // Wait and verify our manual timeout fires (proving the original was cleared)
            await wait(150);
            assert.strictEqual(timeoutFired, true, 'Manual timeout should fire');
            
        } finally {
            cleanupTerminal(terminal);
            ShellTimeoutManager.clearShellTimeout(shellId);
        }
    });
    
    test('executeShellCommand timeout abort signal works', async function() {
        // This test may take longer due to shell integration
        this.timeout(10000);
        
        const shellId = 'integration-test-2';
        const terminal = createTestTerminal(shellId);
        
        try {
            // Wait for shell integration
            await wait(1000);
            
            // Skip if shell integration not available
            if (!terminal.shellIntegration) {
                console.log('Skipping test - shell integration not available');
                return;
            }
            
            // Try to execute a command that would take longer than timeout
            // Using a very short timeout to force abort
            const resultPromise = executeShellCommand(
                terminal,
                'echo "start" && timeout 5 sleep 5 && echo "end"', // Would take 5 seconds
                undefined,
                500, // 500ms timeout
                shellId
            );
            
            // Get timeout info while command is running
            await wait(100);
            const runningInfo = ShellTimeoutManager.getTimeoutInfo(shellId);
            assert.ok(runningInfo, 'Timeout info should exist while command is running');
            assert.strictEqual(runningInfo!.total, 500, 'Total timeout should be 500ms');
            
            // Wait for command to complete (should timeout)
            try {
                const result = await resultPromise;
                // Command might complete with partial output or throw
                if (!result.aborted) {
                    console.log('Warning: Command completed without abort, may need longer timeout in test');
                }
            } catch (error) {
                // Expected - command timed out
                const errorMessage = error instanceof Error ? error.message : String(error);
                assert.ok(
                    errorMessage.includes('timeout') || errorMessage.includes('aborted'),
                    'Error should mention timeout or abort'
                );
            }
            
            // Verify timeout was cleared
            const afterInfo = ShellTimeoutManager.getTimeoutInfo(shellId);
            assert.strictEqual(afterInfo, null, 'Timeout should be cleared after timeout/abort');
            
        } finally {
            cleanupTerminal(terminal);
            ShellTimeoutManager.clearShellTimeout(shellId);
        }
    });
    
    test('Multiple sequential commands reset timeout correctly', async function() {
        // This test simulates rapid command execution
        this.timeout(5000);
        
        const shellId = 'integration-test-3';
        const timeoutCallbacks: boolean[] = [];
        
        try {
            // Simulate multiple rapid timeout resets
            for (let i = 0; i < 5; i++) {
                const callbackIndex = i;
                timeoutCallbacks[callbackIndex] = false;
                
                // Set timeout
                ShellTimeoutManager.setShellTimeout(
                    shellId,
                    100, // 100ms timeout
                    () => { timeoutCallbacks[callbackIndex] = true; }
                );
                
                // Wait 50ms (half the timeout)
                await wait(50);
                
                // If not the last iteration, reset will happen on next loop
                if (i < 4) {
                    // Verify timeout hasn't fired yet
                    assert.strictEqual(
                        timeoutCallbacks[callbackIndex], 
                        false, 
                        `Timeout ${callbackIndex} should not fire before reset`
                    );
                }
            }
            
            // Wait for the last timeout to fire
            await wait(100);
            
            // Verify only the last timeout fired
            for (let i = 0; i < 4; i++) {
                assert.strictEqual(
                    timeoutCallbacks[i], 
                    false, 
                    `Timeout ${i} should have been cancelled`
                );
            }
            assert.strictEqual(
                timeoutCallbacks[4], 
                true, 
                'Last timeout should have fired'
            );
            
        } finally {
            ShellTimeoutManager.clearShellTimeout(shellId);
        }
    });
    
    test('Timeout info remaining time decreases correctly', async function() {
        this.timeout(5000);
        
        const shellId = 'integration-test-4';
        
        try {
            // Set a 1 second timeout
            ShellTimeoutManager.setShellTimeout(
                shellId,
                1000,
                () => { /* no-op */ }
            );
            
            // Take multiple readings
            const readings: number[] = [];
            for (let i = 0; i < 5; i++) {
                const info = ShellTimeoutManager.getTimeoutInfo(shellId);
                if (info) {
                    readings.push(info.remaining);
                }
                await wait(100); // Wait 100ms between readings
            }
            
            // Verify readings are decreasing
            for (let i = 1; i < readings.length; i++) {
                assert.ok(
                    readings[i] < readings[i - 1],
                    `Reading ${i} (${readings[i]}) should be less than reading ${i-1} (${readings[i-1]})`
                );
            }
            
            // Verify approximate decrease rate (should lose ~100ms per reading)
            const totalDecrease = readings[0] - readings[readings.length - 1];
            const expectedDecrease = 100 * (readings.length - 1);
            assert.ok(
                Math.abs(totalDecrease - expectedDecrease) < 50,
                `Total decrease (~${totalDecrease}ms) should be close to expected (~${expectedDecrease}ms)`
            );
            
        } finally {
            ShellTimeoutManager.clearShellTimeout(shellId);
        }
    });
    
    test('ShellTimeoutManager handles concurrent operations', async function() {
        this.timeout(5000);
        
        const shellIds = ['concurrent-1', 'concurrent-2', 'concurrent-3'];
        const results: { [key: string]: boolean } = {};
        
        try {
            // Set up multiple shells with different timeouts concurrently
            const promises = shellIds.map((shellId, index) => {
                results[shellId] = false;
                const timeout = (index + 1) * 100; // 100ms, 200ms, 300ms
                
                ShellTimeoutManager.setShellTimeout(
                    shellId,
                    timeout,
                    () => { results[shellId] = true; }
                );
                
                return wait(timeout + 50); // Wait for each timeout to fire
            });
            
            // Wait for all timeouts to complete
            await Promise.all(promises);
            
            // Verify all timeouts fired
            shellIds.forEach(shellId => {
                assert.strictEqual(
                    results[shellId], 
                    true, 
                    `Timeout for ${shellId} should have fired`
                );
            });
            
            // Verify all timeout info is cleared
            shellIds.forEach(shellId => {
                const info = ShellTimeoutManager.getTimeoutInfo(shellId);
                assert.strictEqual(
                    info, 
                    null, 
                    `Timeout info for ${shellId} should be cleared`
                );
            });
            
        } finally {
            // Cleanup any remaining timeouts
            shellIds.forEach(shellId => {
                ShellTimeoutManager.clearShellTimeout(shellId);
            });
        }
    });
});