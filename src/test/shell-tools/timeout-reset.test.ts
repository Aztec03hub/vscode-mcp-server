import * as assert from 'assert';
import * as vscode from 'vscode';
import { 
    ShellTimeoutManager,
    DEFAULT_TIMEOUT_MS,
} from '../../tools/shell-tools';

/**
 * Test Suite: Shell Timeout Reset Functionality
 * 
 * This test suite validates the timeout reset mechanism for shell commands
 * to ensure timeouts properly refresh when new commands or input are sent.
 */
suite('Shell Timeout Reset Tests', () => {
    
    // Helper function to wait for a specified time
    const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    // Helper function to create a mock timeout callback
    const createTimeoutCallback = (callbackTracker: { called: boolean }) => {
        return () => {
            callbackTracker.called = true;
        };
    };
    
    test('ShellTimeoutManager - Set and Clear Timeout', async () => {
        const shellId = 'test-shell-1';
        const callbackTracker = { called: false };
        
        // Set a timeout
        const controller = ShellTimeoutManager.setShellTimeout(
            shellId,
            100, // 100ms timeout
            createTimeoutCallback(callbackTracker)
        );
        
        // Verify timeout info is available
        const timeoutInfo = ShellTimeoutManager.getTimeoutInfo(shellId);
        assert.ok(timeoutInfo, 'Timeout info should be available');
        assert.strictEqual(timeoutInfo!.total, 100, 'Total timeout should be 100ms');
        assert.ok(timeoutInfo!.remaining > 0, 'Remaining time should be positive');
        
        // Clear the timeout before it fires
        ShellTimeoutManager.clearShellTimeout(shellId);
        
        // Wait to ensure timeout doesn't fire
        await wait(150);
        assert.strictEqual(callbackTracker.called, false, 'Timeout callback should not be called after clearing');
        
        // Verify timeout info is no longer available
        const clearedInfo = ShellTimeoutManager.getTimeoutInfo(shellId);
        assert.strictEqual(clearedInfo, null, 'Timeout info should be null after clearing');
    });
    
    test('ShellTimeoutManager - Timeout Fires When Not Cleared', async () => {
        const shellId = 'test-shell-2';
        const callbackTracker = { called: false };
        
        // Set a short timeout
        ShellTimeoutManager.setShellTimeout(
            shellId,
            50, // 50ms timeout
            createTimeoutCallback(callbackTracker)
        );
        
        // Wait for timeout to fire
        await wait(100);
        assert.strictEqual(callbackTracker.called, true, 'Timeout callback should be called');
        
        // Verify timeout info is cleared after firing
        const firedInfo = ShellTimeoutManager.getTimeoutInfo(shellId);
        assert.strictEqual(firedInfo, null, 'Timeout info should be null after firing');
    });
    
    test('ShellTimeoutManager - Reset Timeout', async () => {
        const shellId = 'test-shell-3';
        const firstCallbackTracker = { called: false };
        const secondCallbackTracker = { called: false };
        
        // Set initial timeout
        ShellTimeoutManager.setShellTimeout(
            shellId,
            100, // 100ms timeout
            createTimeoutCallback(firstCallbackTracker)
        );
        
        // Wait 50ms (half the timeout)
        await wait(50);
        
        // Reset timeout with new duration
        ShellTimeoutManager.resetShellTimeout(
            shellId,
            100, // Another 100ms
            createTimeoutCallback(secondCallbackTracker)
        );
        
        // Wait 75ms more (total 125ms from start)
        await wait(75);
        
        // First callback should not be called (was cancelled)
        assert.strictEqual(firstCallbackTracker.called, false, 'First timeout should be cancelled');
        // Second callback should not be called yet (only 75ms passed since reset)
        assert.strictEqual(secondCallbackTracker.called, false, 'Second timeout should not fire yet');
        
        // Wait another 50ms (total 125ms since reset)
        await wait(50);
        
        // Now second callback should be called
        assert.strictEqual(secondCallbackTracker.called, true, 'Second timeout should fire');
        assert.strictEqual(firstCallbackTracker.called, false, 'First timeout should never fire');
    });
    
    test('ShellTimeoutManager - Multiple Shells Independence', async () => {
        const shell1 = 'test-shell-4';
        const shell2 = 'test-shell-5';
        const callback1Tracker = { called: false };
        const callback2Tracker = { called: false };
        
        // Set timeouts for two different shells
        ShellTimeoutManager.setShellTimeout(
            shell1,
            50,
            createTimeoutCallback(callback1Tracker)
        );
        
        ShellTimeoutManager.setShellTimeout(
            shell2,
            100,
            createTimeoutCallback(callback2Tracker)
        );
        
        // Clear only the first shell's timeout
        ShellTimeoutManager.clearShellTimeout(shell1);
        
        // Wait for both timeouts to potentially fire
        await wait(150);
        
        // First shell's timeout should not fire (was cleared)
        assert.strictEqual(callback1Tracker.called, false, 'Shell 1 timeout should not fire');
        // Second shell's timeout should fire
        assert.strictEqual(callback2Tracker.called, true, 'Shell 2 timeout should fire');
    });
    
    test('ShellTimeoutManager - Abort Controller Integration', async () => {
        const shellId = 'test-shell-6';
        const callbackTracker = { called: false };
        
        // Set timeout and get abort controller
        const controller = ShellTimeoutManager.setShellTimeout(
            shellId,
            100,
            createTimeoutCallback(callbackTracker)
        );
        
        // Verify controller is not aborted initially
        assert.strictEqual(controller.signal.aborted, false, 'Controller should not be aborted initially');
        
        // Clear the timeout
        ShellTimeoutManager.clearShellTimeout(shellId);
        
        // Verify controller is aborted after clearing
        assert.strictEqual(controller.signal.aborted, true, 'Controller should be aborted after clearing');
        
        // Wait to ensure callback doesn't fire
        await wait(150);
        assert.strictEqual(callbackTracker.called, false, 'Callback should not fire after abort');
    });
    
    test('ShellTimeoutManager - Get Timeout Info Accuracy', async () => {
        const shellId = 'test-shell-7';
        const callbackTracker = { called: false };
        
        // Set a 200ms timeout
        ShellTimeoutManager.setShellTimeout(
            shellId,
            200,
            createTimeoutCallback(callbackTracker)
        );
        
        // Check initial timeout info
        const initialInfo = ShellTimeoutManager.getTimeoutInfo(shellId);
        assert.ok(initialInfo, 'Initial timeout info should exist');
        assert.strictEqual(initialInfo!.total, 200, 'Total should be 200ms');
        assert.ok(initialInfo!.remaining <= 200, 'Remaining should be <= 200ms');
        assert.ok(initialInfo!.remaining > 190, 'Remaining should be > 190ms initially');
        
        // Wait 100ms
        await wait(100);
        
        // Check timeout info after waiting
        const midInfo = ShellTimeoutManager.getTimeoutInfo(shellId);
        assert.ok(midInfo, 'Mid-point timeout info should exist');
        assert.strictEqual(midInfo!.total, 200, 'Total should still be 200ms');
        assert.ok(midInfo!.remaining <= 110, 'Remaining should be <= 110ms');
        assert.ok(midInfo!.remaining > 80, 'Remaining should be > 80ms');
        
        // Clear timeout
        ShellTimeoutManager.clearShellTimeout(shellId);
    });
    
    test('ShellTimeoutManager - Dispose All Timeouts', async () => {
        const callbacks = [
            { id: 'dispose-test-1', tracker: { called: false } },
            { id: 'dispose-test-2', tracker: { called: false } },
            { id: 'dispose-test-3', tracker: { called: false } }
        ];
        
        // Set multiple timeouts
        callbacks.forEach(cb => {
            ShellTimeoutManager.setShellTimeout(
                cb.id,
                100,
                createTimeoutCallback(cb.tracker)
            );
        });
        
        // Verify all timeouts exist
        callbacks.forEach(cb => {
            const info = ShellTimeoutManager.getTimeoutInfo(cb.id);
            assert.ok(info, `Timeout for ${cb.id} should exist`);
        });
        
        // Dispose all timeouts
        ShellTimeoutManager.dispose();
        
        // Verify all timeouts are cleared
        callbacks.forEach(cb => {
            const info = ShellTimeoutManager.getTimeoutInfo(cb.id);
            assert.strictEqual(info, null, `Timeout for ${cb.id} should be cleared`);
        });
        
        // Wait to ensure no callbacks fire
        await wait(150);
        callbacks.forEach(cb => {
            assert.strictEqual(cb.tracker.called, false, `Callback for ${cb.id} should not fire`);
        });
    });
    
    test('Timeout Constants Validation', () => {
        // Verify timeout constants are properly defined
        assert.strictEqual(DEFAULT_TIMEOUT_MS, 15000, 'Default timeout should be 15 seconds');
        
        // Verify constants are reasonable
        assert.ok(DEFAULT_TIMEOUT_MS > 0, 'Default timeout should be positive');
    });
});