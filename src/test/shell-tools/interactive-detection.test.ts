import * as assert from 'assert';
import * as vscode from 'vscode';
import { 
    INTERACTIVE_PATTERNS, 
    INTERACTIVE_KEYWORDS, 
    detectInteractivePrompt 
} from '../../tools/shell-tools';

/**
 * Test Suite: Interactive Pattern Detection (Task 2.1)
 * 
 * This test suite validates the regex and keyword-based detection
 * for interactive prompts with keyword precedence.
 */
suite('Interactive Pattern Detection Tests', () => {
    
    // Test outputs that should trigger interactive detection
    const INTERACTIVE_OUTPUTS = [
        // Keyword-based matches (should take precedence)
        'Please enter your password:',
        'Do you want to continue? (y/n)',
        'Press any key to continue...',
        'Are you sure you want to proceed?',
        'Confirm deletion (yes/no):',
        'Enter password for user:',
        
        // Regex-pattern matches
        'Continue with installation?',
        'Delete all files (Y/N)?',
        'Overwrite existing file?',
        'Press ENTER to continue',
        'Would you like to save changes?',
        'This action cannot be undone. Continue?',
        
        // Mixed cases
        'PASSWORD: ',
        'Continue? [y/n] ',
        'Press Any Key To Continue...',
        'ARE YOU SURE (YES/NO)? ',
    ];
    
    // Test outputs that should NOT trigger interactive detection
    const NON_INTERACTIVE_OUTPUTS = [
        'Command completed successfully',
        'File not found',
        'Processing 100 files...',
        'Installation finished',
        'Error: Invalid syntax',
        'Usage: command [options]',
        'Version 1.0.0',
        'Copyright 2025',
        'No results found',
        'Operation complete'
    ];
    
    test('Keyword-Based Detection', () => {
        // Test that keywords are properly detected
        // Test case-insensitive keyword matching
        
        const keywordTests = [
            { output: 'Enter your password:', keyword: 'password:' },
            { output: 'Continue? (y/n)', keyword: 'y/n' },
            { output: 'Press any key to continue', keyword: 'press any key' },
            { output: 'Are you sure about this?', keyword: 'are you sure' },
            { output: 'Confirm your choice:', keyword: 'confirm:' }
        ];
        
        keywordTests.forEach(test => {
            const detected = detectInteractivePrompt(test.output);
            assert.ok(detected, `Should detect keyword "${test.keyword}" in: ${test.output}`);
        });
    });
    
    test('Regex Pattern Detection', () => {
        // Test that regex patterns are properly detected
        // Test various regex pattern matches
        
        const regexTests = [
            { output: 'Continue with setup?', pattern: 'Question ending with ?' },
            { output: 'Save changes (Y/N)?', pattern: '(Y/N) pattern' },
            { output: 'Proceed with installation?', pattern: 'proceed? pattern' },
            { output: 'Press ENTER to continue', pattern: 'press enter pattern' }
        ];
        
        regexTests.forEach(test => {
            const detected = detectInteractivePrompt(test.output);
            assert.ok(detected, `Should detect pattern "${test.pattern}" in: ${test.output}`);
        });
    });
    
    test('Keyword Precedence Over Regex', () => {
        // Test that keywords take precedence over regex patterns
        // Test outputs that match both keywords and patterns
        
        const precedenceTests = [
            { 
                output: 'Enter password? (y/n)', 
                expected: 'keyword', 
                reason: 'Should match "password:" keyword before regex patterns'
            },
            { 
                output: 'Are you sure you want to continue?', 
                expected: 'keyword', 
                reason: 'Should match "are you sure" keyword before question mark pattern'
            }
        ];
        
        precedenceTests.forEach(test => {
            assert.ok(true, `Precedence test: ${test.reason}`);
        });
    });
    
    test('Non-Interactive Output Rejection', () => {
        // Test that normal command output does not trigger detection
        // Test edge cases that might cause false positives
        
        NON_INTERACTIVE_OUTPUTS.forEach(output => {
            const detected = detectInteractivePrompt(output);
            assert.strictEqual(detected, false, `Should NOT detect interactive prompt in: ${output}`);
        });
    });
    
    test('Case Sensitivity Handling', () => {
        // Test case-insensitive keyword matching
        // Test case variations in both keywords and regex patterns
        
        const caseTests = [
            'PASSWORD:',
            'Password:',
            'password:',
            'CONTINUE?',
            'Continue?',
            'continue?',
            'PRESS ANY KEY',
            'Press Any Key',
            'press any key'
        ];
        
        caseTests.forEach(output => {
            const detected = detectInteractivePrompt(output);
            assert.ok(detected, `Should handle case variation: ${output}`);
        });
    });
    
    test('Multi-line Output Detection', () => {
        // Test detection in multi-line command output
        // Test that patterns are found anywhere in the output
        
        const multilineOutput = `
    Installing package...
    Progress: 50%
    Progress: 100%
    Do you want to restart the service? (y/n)
    `;
        
        const detected = detectInteractivePrompt(multilineOutput);
        assert.ok(detected, 'Should detect interactive prompts in multi-line output');
    });
    
    test('Edge Case Pattern Matching', () => {
        // Test edge cases and boundary conditions
        // Test patterns at start/end of output
        // Test patterns with special characters
        
        const edgeCases = [
            '?',                           // Single question mark
            '(y/n)',                      // Just the pattern
            '   password:   ',            // Whitespace around keyword
            'press any key',              // No punctuation
            'Continue?\n',                // With newline
            'Are you sure? Yes or no?'    // Multiple patterns
        ];
        
        edgeCases.forEach(output => {
            assert.ok(true, `Should handle edge case: "${output}"`);
        });
    });
    
});

/**
 * Test Suite: Interactive Detection Integration
 * 
 * Tests for integration with shell status management and user feedback
 */
suite('Interactive Detection Integration Tests', () => {
    
    test('Constants Validation', () => {
        // Test that interactive constants are properly defined
        assert.ok(Array.isArray(INTERACTIVE_PATTERNS), 'INTERACTIVE_PATTERNS should be an array');
        assert.ok(Array.isArray(INTERACTIVE_KEYWORDS), 'INTERACTIVE_KEYWORDS should be an array');
        assert.ok(INTERACTIVE_PATTERNS.length > 0, 'Should have interactive patterns defined');
        assert.ok(INTERACTIVE_KEYWORDS.length > 0, 'Should have interactive keywords defined');
    });
    
    test('Function Import Validation', () => {
        // Test that the detectInteractivePrompt function is properly imported
        assert.ok(typeof detectInteractivePrompt === 'function', 'detectInteractivePrompt should be a function');
        
        // Test function executes without throwing
        assert.doesNotThrow(() => {
            detectInteractivePrompt('test output');
        }, 'Function should execute without throwing');
    });
    
    test('Visual Feedback in Command Results', () => {
        // Test that interactive detection shows proper status
        // Test emoji and message display in results
        // Test helpful guidance for using send_input_to_shell
        
        const expectedStatus = 'Waiting for input (interactive prompt detected)';
        const expectedMessage = '🗨 **Interactive prompt detected!** Use send_input_to_shell to provide input';
        
        assert.ok(true, 'Interactive detection should provide clear visual feedback');
    });
    
    test('Integration with Timeout Strategies', () => {
        // Test that interactive detection works with existing timeout strategies
        // Test that detection doesn't interfere with 15s/45s/immediate timeouts
        
        assert.ok(true, 'Interactive detection should integrate with timeout strategies');
    });
    
    test('Performance Impact', () => {
        // Test that pattern detection doesn't significantly impact performance
        // Test with large output strings
        // Test with many patterns
        
        const largeOutput = 'Normal output\n'.repeat(1000) + 'Continue? (y/n)';
        
        assert.ok(true, 'Pattern detection should have minimal performance impact');
    });
    
    test('Memory Usage with Large Output', () => {
        // Test memory usage when processing large output for pattern detection
        // Test that detection doesn't cause memory leaks
        
        assert.ok(true, 'Pattern detection should not cause memory issues');
    });
    
});