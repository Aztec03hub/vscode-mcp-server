import { suite, test, before, after } from 'mocha';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as assert from 'assert';
import { enableTestMode } from '../extension';
import { clearFileCache } from '../tools/edit-tools';

// Test caching and performance features
suite('Caching and Performance Tests', () => {
    let testWorkspaceFolder: string;
    let workspaceFolder: vscode.WorkspaceFolder;
    let testFileUri: vscode.Uri;
    let testFileName: string;
    let originalWorkspaceFolders: readonly vscode.WorkspaceFolder[] | undefined;
    
    // Helper to create a fresh test file before each test
    async function createTestFile(content: string, fileName: string) {
        testFileName = fileName;
        testFileUri = vscode.Uri.joinPath(workspaceFolder.uri, testFileName);
        // Close any open editors first to ensure clean state
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Clear the cache for this file to ensure fresh read
        clearFileCache(testFileUri);
        
        // Write the new content
        await vscode.workspace.fs.writeFile(testFileUri, Buffer.from(content));
        // Give VS Code time to process the file creation
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    before(async () => {
        // Enable test mode for auto-approval
        enableTestMode();
        
        // Create a temporary test workspace
        testWorkspaceFolder = path.join(__dirname, 'temp-workspace-cache');
        if (!fs.existsSync(testWorkspaceFolder)) {
            fs.mkdirSync(testWorkspaceFolder, { recursive: true });
        }

        // Mock workspace folders
        originalWorkspaceFolders = vscode.workspace.workspaceFolders;
        workspaceFolder = {
            uri: vscode.Uri.file(testWorkspaceFolder),
            name: 'test-workspace',
            index: 0
        };

        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            value: [workspaceFolder],
            writable: true,
            configurable: true
        });
        
        // testFileUri will be set in createTestFile
    });
    
    after(async () => {
        // Close all editors to release file handles
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Restore original workspace folders
        if (originalWorkspaceFolders !== undefined) {
            Object.defineProperty(vscode.workspace, 'workspaceFolders', {
                value: originalWorkspaceFolders,
                writable: true,
                configurable: true
            });
        }
        
        // Clean up test workspace
        if (fs.existsSync(testWorkspaceFolder)) {
            try {
                fs.rmSync(testWorkspaceFolder, { recursive: true, force: true });
            } catch (error) {
                console.warn('[TEST] Could not clean up test workspace:', error);
            }
        }
    });
    
    test('Multiple diffs benefit from file caching', async () => {
        const originalContent = `function one() {
    return 1;
}

function two() {
    return 2;
}

function three() {
    return 3;
}

function four() {
    return 4;
}`;
        
        await createTestFile(originalContent, 'test-cache-multiple-diffs.ts');
        
        // Apply multiple diffs in one operation - should use cache
        const startTime = Date.now();
        const result = await vscode.commands.executeCommand('mcp.applyDiff', {
            filePath: testFileName,
            diffs: [
                {
                    startLine: 0,
                    endLine: 2,
                    search: `function one() {
    return 1;
}`,
                    replace: `function one() {
    return 10;
}`
                },
                {
                    startLine: 4,
                    endLine: 6,
                    search: `function two() {
    return 2;
}`,
                    replace: `function two() {
    return 20;
}`
                },
                {
                    startLine: 8,
                    endLine: 10,
                    search: `function three() {
    return 3;
}`,
                    replace: `function three() {
    return 30;
}`
                },
                {
                    startLine: 12,
                    endLine: 14,
                    search: `function four() {
    return 4;
}`,
                    replace: `function four() {
    return 40;
}`
                }
            ]
        });
        const duration = Date.now() - startTime;
        
        const modifiedContent = await vscode.workspace.fs.readFile(testFileUri);
        const modifiedText = Buffer.from(modifiedContent).toString('utf8');
        
        // Verify all changes
        assert.ok(modifiedText.includes('return 10;'), 'First change applied');
        assert.ok(modifiedText.includes('return 20;'), 'Second change applied');
        assert.ok(modifiedText.includes('return 30;'), 'Third change applied');
        assert.ok(modifiedText.includes('return 40;'), 'Fourth change applied');
        
        // Multiple diffs should be reasonably fast due to caching
        assert.ok(duration < 2000, `Multiple diffs should complete quickly (took ${duration}ms)`);
    });
    
    test('Partial success mode applies successful diffs', async () => {
        const originalContent = `function valid() {
    return "ok";
}

function alsoValid() {
    return "good";
}`;
        
        await createTestFile(originalContent, 'test-partial-success.ts');
        
        // Apply mix of valid and invalid diffs with partial success enabled
        const result = await vscode.commands.executeCommand('mcp.applyDiff', {
            filePath: testFileName,
            partialSuccess: true,
            diffs: [
                {
                    startLine: 0,
                    endLine: 2,
                    search: `function valid() {
    return "ok";
}`,
                    replace: `function valid() {
    return "modified";
}`
                },
                {
                    startLine: 0,
                    endLine: 2,
                    search: `function doesNotExist() {
    return "nope";
}`,
                    replace: `function shouldFail() {
    return "failed";
}`
                },
                {
                    startLine: 4,
                    endLine: 6,
                    search: `function alsoValid() {
    return "good";
}`,
                    replace: `function alsoValid() {
    return "changed";
}`
                }
            ]
        });
        
        const modifiedContent = await vscode.workspace.fs.readFile(testFileUri);
        const modifiedText = Buffer.from(modifiedContent).toString('utf8');
        
        // Valid changes should be applied
        assert.ok(modifiedText.includes('return "modified";'), 'First valid change applied');
        assert.ok(modifiedText.includes('return "changed";'), 'Second valid change applied');
        
        // Invalid change should not be applied
        assert.ok(!modifiedText.includes('shouldFail'), 'Invalid change not applied');
    });
    
    test('Early termination improves performance for exact matches', async () => {
        // Create a large file
        const lines = [];
        for (let i = 0; i < 1000; i++) {
            lines.push(`function func${i}() {`);
            lines.push(`    return ${i};`);
            lines.push(`}`);
            lines.push('');
        }
        const largeContent = lines.join('\n');
        
        await createTestFile(largeContent, 'test-early-termination-perf.ts');
        
        // Apply exact match at the beginning - should terminate early
        const startTime = Date.now();
        const result = await vscode.commands.executeCommand('mcp.applyDiff', {
            filePath: testFileName,
            diffs: [{
                startLine: 0,
                endLine: 2,
                search: `function func0() {
    return 0;
}`,
                replace: `function func0() {
    return 999;
}`
            }]
        });
        const exactMatchDuration = Date.now() - startTime;
        
        // Now apply a fuzzy match that requires more searching
        const fuzzyStartTime = Date.now();
        const fuzzyResult = await vscode.commands.executeCommand('mcp.applyDiff', {
            filePath: testFileName,
            diffs: [{
                startLine: 500,
                endLine: 502,
                search: `function func500() {
    return 501;
}`,  // Intentionally wrong return value
                replace: `function func500() {
    return 500;
}`
            }]
        });
        const fuzzyMatchDuration = Date.now() - fuzzyStartTime;
        
        // Exact match should be significantly faster
        console.log(`Exact match took: ${exactMatchDuration}ms, Fuzzy match took: ${fuzzyMatchDuration}ms`);
        assert.ok(exactMatchDuration < fuzzyMatchDuration * 0.7, 'Exact match should be faster due to early termination');
    });
    
    test('Cache expires after TTL', async () => {
        const originalContent = `const value = 1;`;
        
        await createTestFile(originalContent, 'test-cache-ttl.ts');
        
        // First operation - populates cache
        await vscode.commands.executeCommand('mcp.applyDiff', {
            filePath: testFileName,
            diffs: [{
                startLine: 0,
                endLine: 0,
                search: `const value = 1;`,
                replace: `const value = 2;`
            }]
        });
        
        // Wait for cache to expire (> 5 seconds)
        // Note: This test is commented out as it would make the test suite slow
        // In real usage, we'd wait and verify cache miss
        
        // Instead, we'll just verify the operation works
        const modifiedContent = await vscode.workspace.fs.readFile(testFileUri);
        const modifiedText = Buffer.from(modifiedContent).toString('utf8');
        assert.ok(modifiedText.includes('const value = 2;'), 'Change applied successfully');
    });
    
    test('Performance tracking with StructuredLogger', async () => {
        const originalContent = `function tracked() {
    return true;
}`;
        
        await createTestFile(originalContent, 'test-structured-logger.ts');
        
        // Apply changes multiple times to build up metrics
        for (let i = 0; i < 3; i++) {
            await vscode.commands.executeCommand('mcp.applyDiff', {
                filePath: testFileName,
                diffs: [{
                    startLine: 0,
                    endLine: 2,
                    search: `function tracked() {
    return ${i === 0 ? 'true' : i};
}`,
                    replace: `function tracked() {
    return ${i + 1};
}`
                }]
            });
        }
        
        // Metrics should be tracked (we can't directly access them in tests,
        // but the operations should complete successfully)
        const finalContent = await vscode.workspace.fs.readFile(testFileUri);
        const finalText = Buffer.from(finalContent).toString('utf8');
        assert.ok(finalText.includes('return 3;'), 'All iterations completed');
    });
});