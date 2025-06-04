// Simple test runner to validate shell tools tests
// This script imports and validates our test modules

import * as assert from 'assert';

console.log('🧪 Running Shell Tools Test Validation...');

try {
    // Test 1: Validate shell-tools exports
    console.log('\n1. Testing shell-tools exports...');
    
    const shellTools = require('../../tools/shell-tools');
    
    assert.ok(typeof shellTools.MAX_SHELLS === 'number', 'MAX_SHELLS should be exported');
    assert.ok(typeof shellTools.DEFAULT_OUTPUT_CHARACTER_LIMIT === 'number', 'DEFAULT_OUTPUT_CHARACTER_LIMIT should be exported');
    assert.ok(typeof shellTools.detectDestructiveCommand === 'function', 'detectDestructiveCommand should be exported');
    assert.ok(typeof shellTools.detectInteractivePrompt === 'function', 'detectInteractivePrompt should be exported');
    
    console.log('✅ Shell tools exports validated');
    
    // Test 2: Test detectDestructiveCommand function
    console.log('\n2. Testing detectDestructiveCommand...');
    
    const safeCommand = 'ls -la';
    const destructiveCommand = 'rm -rf /';
    
    const safeResult = shellTools.detectDestructiveCommand(safeCommand);
    const destructiveResult = shellTools.detectDestructiveCommand(destructiveCommand);
    
    assert.strictEqual(safeResult, null, 'Safe command should not trigger warning');
    assert.ok(destructiveResult !== null, 'Destructive command should trigger warning');
    assert.ok(destructiveResult.includes('SAFETY WARNING'), 'Warning should contain safety message');
    
    console.log('✅ detectDestructiveCommand function validated');
    
    // Test 3: Test detectInteractivePrompt function
    console.log('\n3. Testing detectInteractivePrompt...');
    
    const normalOutput = 'Command completed successfully';
    const interactiveOutput = 'Continue? (y/n)';
    
    const normalResult = shellTools.detectInteractivePrompt(normalOutput);
    const interactiveResult = shellTools.detectInteractivePrompt(interactiveOutput);
    
    assert.strictEqual(normalResult, false, 'Normal output should not trigger detection');
    assert.strictEqual(interactiveResult, true, 'Interactive output should trigger detection');
    
    console.log('✅ detectInteractivePrompt function validated');
    
    // Test 4: Test constants
    console.log('\n4. Testing constants...');
    
    assert.strictEqual(shellTools.MAX_SHELLS, 8, 'MAX_SHELLS should be 8');
    assert.strictEqual(shellTools.DEFAULT_OUTPUT_CHARACTER_LIMIT, 100000, 'Character limit should be 100k');
    assert.ok(Array.isArray(shellTools.DESTRUCTIVE_PATTERNS), 'DESTRUCTIVE_PATTERNS should be array');
    assert.ok(Array.isArray(shellTools.INTERACTIVE_PATTERNS), 'INTERACTIVE_PATTERNS should be array');
    assert.ok(Array.isArray(shellTools.INTERACTIVE_KEYWORDS), 'INTERACTIVE_KEYWORDS should be array');
    
    console.log('✅ Constants validated');
    
    console.log('\n🎉 All shell tools validations passed!');
    
} catch (error) {
    console.error('\n❌ Test validation failed:', error);
    process.exit(1);
}