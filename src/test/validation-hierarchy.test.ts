import { suite, test, before, after } from 'mocha';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as assert from 'assert';
import { enableTestMode } from '../extension';
import { clearFileCache } from '../tools/edit-tools';

// Since ValidationHierarchy is not exported, we need to test it through the apply_diff functionality
// This test file focuses on testing the validation hierarchy behavior

suite('ValidationHierarchy Tests', () => {
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
        testWorkspaceFolder = path.join(__dirname, 'temp-workspace-validation');
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
    
    test('Exact match at hint location (Level 1)', async () => {
        const originalContent = `function hello() {
    console.log("Hello, world!");
}

function goodbye() {
    console.log("Goodbye!");
}`;
        
        // Create test file
        await createTestFile(originalContent, 'test-exact-match-hint.ts');
        
        // Apply diff with exact match at hinted location
        const result = await vscode.commands.executeCommand('mcp.applyDiff', {
            filePath: testFileName,
            diffs: [{
                startLine: 4,
                endLine: 6,
                search: `function goodbye() {
    console.log("Goodbye!");
}`,
                replace: `function goodbye() {
    console.log("Farewell!");
}`
            }]
        });
        
        // Read the file and verify the change
        const modifiedContent = await vscode.workspace.fs.readFile(testFileUri);
        const modifiedText = Buffer.from(modifiedContent).toString('utf8');
        
        assert.ok(modifiedText.includes('console.log("Farewell!");'), 'File should contain the replacement text');
        assert.ok(!modifiedText.includes('console.log("Goodbye!");'), 'Original text should be replaced');
    });
    
    test('Exact match near hint (Level 1 - radius search)', async () => {
        const originalContent = `// Some comment
function hello() {
    console.log("Hello!");
}

// Another comment
function test() {
    return true;
}`;
        
        await createTestFile(originalContent, 'test-exact-match-near.ts');
        
        // Apply diff with hint slightly off (actual function is at line 6, hint at line 5)
        const result = await vscode.commands.executeCommand('mcp.applyDiff', {
            filePath: testFileName,
            diffs: [{
                startLine: 5,
                endLine: 8,
                search: `function test() {
    return true;
}`,
                replace: `function test() {
    return false;
}`
            }]
        });
        
        const modifiedContent = await vscode.workspace.fs.readFile(testFileUri);
        const modifiedText = Buffer.from(modifiedContent).toString('utf8');
        
        assert.ok(modifiedText.includes('return false;'), 'Should find and replace despite hint being slightly off');
    });
    
    test('Whitespace-normalized match (Level 2)', async () => {
        const originalContent = `function example() {
\t\tconsole.log("Indented with tabs");
    return 42;
}`;
        
        await createTestFile(originalContent, 'test-whitespace-normalized.ts');
        
        // Apply diff with different whitespace
        const result = await vscode.commands.executeCommand('mcp.applyDiff', {
            filePath: testFileName,
            diffs: [{
                startLine: 0,
                endLine: 3,
                search: `function example() {
  console.log("Indented with tabs");
  return 42;
}`,
                replace: `function example() {
    console.log("Now with spaces");
    return 42;
}`
            }]
        });
        
        const modifiedContent = await vscode.workspace.fs.readFile(testFileUri);
        const modifiedText = Buffer.from(modifiedContent).toString('utf8');
        
        assert.ok(modifiedText.includes('Now with spaces'), 'Should match despite whitespace differences');
    });
    
    test('Case-insensitive match (Level 2)', async () => {
        const originalContent = `function MyFunction() {
    const MESSAGE = "Hello";
    console.log(MESSAGE);
}`;
        
        await createTestFile(originalContent, 'test-case-insensitive.ts');
        
        // Apply diff with different casing in search
        const result = await vscode.commands.executeCommand('mcp.applyDiff', {
            filePath: testFileName,
            diffs: [{
                startLine: 0,
                endLine: 3,
                search: `function myfunction() {
    const message = "Hello";
    console.log(message);
}`,
                replace: `function MyFunction() {
    const MESSAGE = "Hi there";
    console.log(MESSAGE);
}`
            }]
        });
        
        const modifiedContent = await vscode.workspace.fs.readFile(testFileUri);
        const modifiedText = Buffer.from(modifiedContent).toString('utf8');
        
        assert.ok(modifiedText.includes('Hi there'), 'Should match with case-insensitive strategy');
    });
    
    test('Similarity match (Level 3)', async () => {
        const originalContent = `function calculate(a, b) {
    // Perform calculation
    const result = a + b;
    return result;
}`;
        
        await createTestFile(originalContent, 'test-similarity-match.ts');
        
        // Apply diff with slightly different content (missing comment, different variable name)
        const result = await vscode.commands.executeCommand('mcp.applyDiff', {
            filePath: testFileName,
            diffs: [{
                startLine: 0,
                endLine: 4,
                search: `function calculate(a, b) {
    const sum = a + b;
    return sum;
}`,
                replace: `function calculate(a, b) {
    // Calculate sum of two numbers
    const sum = a + b;
    return sum;
}`
            }]
        });
        
        const modifiedContent = await vscode.workspace.fs.readFile(testFileUri);
        const modifiedText = Buffer.from(modifiedContent).toString('utf8');
        
        assert.ok(modifiedText.includes('Calculate sum of two numbers'), 'Should match with similarity strategy');
    });
    
    test('Multiple identical matches with line hint disambiguation', async () => {
        const originalContent = `function process(data) {
    return data * 2;
}

function process(data) {
    return data * 2;
}

function process(data) {
    return data * 2;
}`;
        
        await createTestFile(originalContent, 'test-multiple-matches.ts');
        
        // Apply diff to the middle occurrence using line hint
        const result = await vscode.commands.executeCommand('mcp.applyDiff', {
            filePath: testFileName,
            diffs: [{
                startLine: 4,
                endLine: 6,
                search: `function process(data) {
    return data * 2;
}`,
                replace: `function process(data) {
    return data * 3; // Modified
}`
            }]
        });
        
        const modifiedContent = await vscode.workspace.fs.readFile(testFileUri);
        const modifiedText = Buffer.from(modifiedContent).toString('utf8');
        
        // Count occurrences of each version
        const originalMatches = (modifiedText.match(/return data \* 2;/g) || []).length;
        const modifiedMatches = (modifiedText.match(/return data \* 3;/g) || []).length;
        
        assert.strictEqual(originalMatches, 2, 'Should have 2 original functions remaining');
        assert.strictEqual(modifiedMatches, 1, 'Should have 1 modified function');
        assert.ok(modifiedText.includes('// Modified'), 'Should include the comment from replacement');
    });
    
    test('Early termination on high confidence match', async () => {
        const originalContent = `function quickMatch() {
    return "exact";
}`;
        
        await createTestFile(originalContent, 'test-early-termination.ts');
        
        // This should match exactly and terminate early without trying other strategies
        const startTime = Date.now();
        const result = await vscode.commands.executeCommand('mcp.applyDiff', {
            filePath: testFileName,
            diffs: [{
                startLine: 0,
                endLine: 2,
                search: `function quickMatch() {
    return "exact";
}`,
                replace: `function quickMatch() {
    return "modified";
}`
            }]
        });
        const duration = Date.now() - startTime;
        
        const modifiedContent = await vscode.workspace.fs.readFile(testFileUri);
        const modifiedText = Buffer.from(modifiedContent).toString('utf8');
        
        assert.ok(modifiedText.includes('return "modified";'), 'Should have applied the change');
        // The exact match should be fast (early termination)
        assert.ok(duration < 1000, 'Should complete quickly with early termination');
    });
    
    test('Failed match handling', async () => {
        const originalContent = `function original() {
    return 1;
}`;
        
        await createTestFile(originalContent, 'test-failed-match.ts');
        
        // Try to match content that doesn't exist
        try {
            await vscode.commands.executeCommand('mcp.applyDiff', {
                filePath: testFileName,
                diffs: [{
                    startLine: 0,
                    endLine: 2,
                    search: `function nonexistent() {
    return 999;
}`,
                    replace: `function replacement() {
    return 0;
}`
                }]
            });
            assert.fail('Should have thrown an error for non-matching content');
        } catch (error) {
            assert.ok(error instanceof Error, 'Should throw an Error');
            assert.ok(error.message.includes('Validation failed'), 'Error should mention validation failure');
        }
    });
});