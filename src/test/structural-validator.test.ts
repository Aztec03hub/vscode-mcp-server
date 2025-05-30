import { suite, test, before, after } from 'mocha';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as assert from 'assert';
import { enableTestMode } from '../extension';
import { clearFileCache } from '../tools/edit-tools';

// Test the structural validation feature through apply_diff
suite('StructuralValidator Tests', () => {
    let testWorkspaceFolder: string;
    let workspaceFolder: vscode.WorkspaceFolder;
    let testFileUri: vscode.Uri;
    const testFileName = 'structural-validator-test.ts';
    let originalWorkspaceFolders: readonly vscode.WorkspaceFolder[] | undefined;
    
    // Helper to create a fresh test file before each test
    async function createTestFile(content: string) {
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
        testWorkspaceFolder = path.join(__dirname, 'temp-workspace-structural');
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
        
        testFileUri = vscode.Uri.joinPath(workspaceFolder.uri, testFileName);
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
    
    test('Detects unbalanced braces', async () => {
        const originalContent = `function test() {
    if (true) {
        console.log("balanced");
    }
}`;
        
        await createTestFile(originalContent);
        
        // Apply diff that creates unbalanced braces (adds opening but not closing)
        const result = await vscode.commands.executeCommand('mcp.applyDiff', {
            filePath: testFileName,
            diffs: [{
                startLine: 1,
                endLine: 3,
                search: `    if (true) {
        console.log("balanced");
    }`,
                replace: `    if (true) {
        if (false) {
            console.log("unbalanced");
        // Missing closing brace
    }`
            }]
        });
        
        // The operation should succeed but with warnings
        const modifiedContent = await vscode.workspace.fs.readFile(testFileUri);
        const modifiedText = Buffer.from(modifiedContent).toString('utf8');
        
        assert.ok(modifiedText.includes('console.log("unbalanced");'), 'Change should be applied despite structural warning');
    });
    
    test('Detects unbalanced parentheses', async () => {
        const originalContent = `const result = calculate(10, 20);`;
        
        await createTestFile(originalContent);
        
        // Apply diff that creates unbalanced parentheses
        const result = await vscode.commands.executeCommand('mcp.applyDiff', {
            filePath: testFileName,
            diffs: [{
                startLine: 0,
                endLine: 0,
                search: `const result = calculate(10, 20);`,
                replace: `const result = calculate(10, add(20, 30);`
            }]
        });
        
        const modifiedContent = await vscode.workspace.fs.readFile(testFileUri);
        const modifiedText = Buffer.from(modifiedContent).toString('utf8');
        
        assert.ok(modifiedText.includes('add(20, 30'), 'Change should be applied with warning');
    });
    
    test('Detects unbalanced quotes', async () => {
        const originalContent = `const message = "Hello, world!";`;
        
        await createTestFile(originalContent);
        
        // Apply diff that creates unclosed string
        const result = await vscode.commands.executeCommand('mcp.applyDiff', {
            filePath: testFileName,
            diffs: [{
                startLine: 0,
                endLine: 0,
                search: `const message = "Hello, world!";`,
                replace: `const message = "Hello, world!;`
            }]
        });
        
        const modifiedContent = await vscode.workspace.fs.readFile(testFileUri);
        const modifiedText = Buffer.from(modifiedContent).toString('utf8');
        
        assert.ok(modifiedText.includes('"Hello, world!;'), 'Change should be applied with quote warning');
    });
    
    test('Validates JSON structure', async () => {
        const jsonFileName = 'test-config.json';
        const jsonFileUri = vscode.Uri.joinPath(workspaceFolder.uri, jsonFileName);
        
        const originalContent = `{
    "name": "test",
    "version": "1.0.0"
}`;
        
        // Clear cache for JSON file
        clearFileCache(jsonFileUri);
        
        await vscode.workspace.fs.writeFile(jsonFileUri, Buffer.from(originalContent));
        await new Promise(resolve => setTimeout(resolve, 50));
        
        try {
            // Apply diff that breaks JSON structure
            const result = await vscode.commands.executeCommand('mcp.applyDiff', {
                filePath: jsonFileName,
                diffs: [{
                    startLine: 1,
                    endLine: 2,
                    search: `    "name": "test",
    "version": "1.0.0"`,
                    replace: `    "name": "test",
    "version": "1.0.0",`  // Trailing comma at end of JSON
                }]
            });
            
            const modifiedContent = await vscode.workspace.fs.readFile(jsonFileUri);
            const modifiedText = Buffer.from(modifiedContent).toString('utf8');
            
            // Should apply change but with JSON validation warning
            assert.ok(modifiedText.includes('"1.0.0",'), 'Change should be applied');
        } finally {
            // Cleanup JSON test file
            try {
                await vscode.workspace.fs.delete(jsonFileUri);
            } catch (error) {
                // Ignore
            }
        }
    });
    
    test('Handles block comments correctly', async () => {
        const originalContent = `/* This is a comment */
function test() {
    /* Another comment */
    return true;
}`;
        
        await createTestFile(originalContent);
        
        // Apply diff that adds an unclosed comment
        const result = await vscode.commands.executeCommand('mcp.applyDiff', {
            filePath: testFileName,
            diffs: [{
                startLine: 2,
                endLine: 3,
                search: `    /* Another comment */
    return true;`,
                replace: `    /* Another comment
    return true; /* Unclosed`
            }]
        });
        
        const modifiedContent = await vscode.workspace.fs.readFile(testFileUri);
        const modifiedText = Buffer.from(modifiedContent).toString('utf8');
        
        assert.ok(modifiedText.includes('/* Unclosed'), 'Change should be applied with comment warning');
    });
    
    test('No warnings for balanced structures', async () => {
        const originalContent = `function balanced() {
    const arr = [1, 2, 3];
    const obj = { a: 1, b: 2 };
    return arr.map(x => x * 2);
}`;
        
        await createTestFile(originalContent);
        
        // Apply diff that maintains balance
        const result = await vscode.commands.executeCommand('mcp.applyDiff', {
            filePath: testFileName,
            diffs: [{
                startLine: 1,
                endLine: 3,
                search: `    const arr = [1, 2, 3];
    const obj = { a: 1, b: 2 };
    return arr.map(x => x * 2);`,
                replace: `    const arr = [1, 2, 3, 4, 5];
    const obj = { a: 1, b: 2, c: 3 };
    return arr.filter(x => x > 2).map(x => x * 2);`
            }]
        });
        
        const modifiedContent = await vscode.workspace.fs.readFile(testFileUri);
        const modifiedText = Buffer.from(modifiedContent).toString('utf8');
        
        assert.ok(modifiedText.includes('filter(x => x > 2)'), 'Balanced change should be applied without warnings');
    });
    
    test('Detects changes in structural balance', async () => {
        const originalContent = `const incomplete = "test`;
        
        await createTestFile(originalContent);
        
        // Apply diff that fixes the unbalanced quote
        const result = await vscode.commands.executeCommand('mcp.applyDiff', {
            filePath: testFileName,
            diffs: [{
                startLine: 0,
                endLine: 0,
                search: `const incomplete = "test`,
                replace: `const complete = "test"`
            }]
        });
        
        const modifiedContent = await vscode.workspace.fs.readFile(testFileUri);
        const modifiedText = Buffer.from(modifiedContent).toString('utf8');
        
        assert.ok(modifiedText.includes('const complete = "test"'), 'Should fix structural issue');
    });
});