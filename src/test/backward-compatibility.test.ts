import * as assert from 'assert';
import { suite, test, before, after } from 'mocha';
import * as vscode from 'vscode';
import * as path from 'path';

// Test backward compatibility with old parameter names
suite('Backward Compatibility Tests', () => {
    let workspaceFolder: vscode.WorkspaceFolder;
    let testFileUri: vscode.Uri;
    const testFileName = 'backward-compat-test.ts';
    
    before(async () => {
        // Setup test workspace
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            assert.fail('No workspace folder is open');
        }
        workspaceFolder = vscode.workspace.workspaceFolders[0];
        testFileUri = vscode.Uri.joinPath(workspaceFolder.uri, testFileName);
    });
    
    after(async () => {
        // Cleanup test file
        try {
            await vscode.workspace.fs.delete(testFileUri);
        } catch (error) {
            // Ignore if file doesn't exist
        }
    });
    
    test('Old parameter names (originalContent/newContent) still work', async () => {
        const originalContent = `function oldStyle() {
    return "original";
}`;
        
        await vscode.workspace.fs.writeFile(testFileUri, Buffer.from(originalContent));
        
        // Use old parameter names - should still work with deprecation warnings
        const result = await vscode.commands.executeCommand('mcp.applyDiff', {
            filePath: testFileName,
            diffs: [{
                startLine: 0,
                endLine: 2,
                originalContent: `function oldStyle() {
    return "original";
}`,
                newContent: `function oldStyle() {
    return "updated";
}`
            }]
        });
        
        const modifiedContent = await vscode.workspace.fs.readFile(testFileUri);
        const modifiedText = Buffer.from(modifiedContent).toString('utf8');
        
        assert.ok(modifiedText.includes('return "updated";'), 'Old parameter names should work');
    });
    
    test('Mixed old and new parameter names work', async () => {
        const originalContent = `function first() {
    return 1;
}

function second() {
    return 2;
}`;
        
        await vscode.workspace.fs.writeFile(testFileUri, Buffer.from(originalContent));
        
        // Mix old and new parameter names
        const result = await vscode.commands.executeCommand('mcp.applyDiff', {
            filePath: testFileName,
            diffs: [
                {
                    startLine: 0,
                    endLine: 2,
                    // Using new parameter names
                    search: `function first() {
    return 1;
}`,
                    replace: `function first() {
    return 10;
}`
                },
                {
                    startLine: 4,
                    endLine: 6,
                    // Using old parameter names
                    originalContent: `function second() {
    return 2;
}`,
                    newContent: `function second() {
    return 20;
}`
                }
            ]
        });
        
        const modifiedContent = await vscode.workspace.fs.readFile(testFileUri);
        const modifiedText = Buffer.from(modifiedContent).toString('utf8');
        
        assert.ok(modifiedText.includes('return 10;'), 'New parameter names should work');
        assert.ok(modifiedText.includes('return 20;'), 'Old parameter names should work alongside new');
    });
    
    test('Existing file creation behavior preserved', async () => {
        const newFileName = 'new-file-compat-test.ts';
        const newFileUri = vscode.Uri.joinPath(workspaceFolder.uri, newFileName);
        
        try {
            // Ensure file doesn't exist
            try {
                await vscode.workspace.fs.delete(newFileUri);
            } catch (error) {
                // Ignore if doesn't exist
            }
            
            // Apply diff to non-existent file - should create it
            const result = await vscode.commands.executeCommand('mcp.applyDiff', {
                filePath: newFileName,
                diffs: [{
                    startLine: 0,
                    endLine: 0,
                    search: '',  // Empty search for new file
                    replace: `// Auto-created file\nconst value = 42;`
                }]
            });
            
            // Verify file was created
            const content = await vscode.workspace.fs.readFile(newFileUri);
            const text = Buffer.from(content).toString('utf8');
            
            assert.ok(text.includes('Auto-created file'), 'File should be created');
            assert.ok(text.includes('const value = 42'), 'Content should be inserted');
        } finally {
            // Cleanup
            try {
                await vscode.workspace.fs.delete(newFileUri);
            } catch (error) {
                // Ignore
            }
        }
    });
    
    test('Line-based replacement behavior unchanged', async () => {
        const originalContent = `line1
line2
line3
line4
line5`;
        
        await vscode.workspace.fs.writeFile(testFileUri, Buffer.from(originalContent));
        
        // Test traditional line-based replacement
        const result = await vscode.commands.executeCommand('mcp.applyDiff', {
            filePath: testFileName,
            diffs: [{
                startLine: 1,
                endLine: 3,
                search: `line2
line3
line4`,
                replace: `modified2
modified3
modified4`
            }]
        });
        
        const modifiedContent = await vscode.workspace.fs.readFile(testFileUri);
        const modifiedText = Buffer.from(modifiedContent).toString('utf8');
        
        assert.strictEqual(modifiedText, 'line1\nmodified2\nmodified3\nmodified4\nline5', 'Line replacement should work as before');
    });
    
    test('Error behavior for invalid parameters unchanged', async () => {
        const originalContent = `const test = true;`;
        
        await vscode.workspace.fs.writeFile(testFileUri, Buffer.from(originalContent));
        
        // Test with missing required parameters
        try {
            await vscode.commands.executeCommand('mcp.applyDiff', {
                filePath: testFileName,
                diffs: [{
                    startLine: 0,
                    endLine: 0
                    // Missing both search/originalContent and replace/newContent
                }]
            });
            assert.fail('Should throw error for missing parameters');
        } catch (error) {
            assert.ok(error instanceof Error, 'Should throw Error');
            assert.ok(error.message.includes('missing required'), 'Error should mention missing parameters');
        }
    });
    
    test('Multi-diff behavior preserved', async () => {
        const originalContent = `function a() { return 1; }
function b() { return 2; }
function c() { return 3; }`;
        
        await vscode.workspace.fs.writeFile(testFileUri, Buffer.from(originalContent));
        
        // Apply multiple diffs in reverse order (bottom to top)
        const result = await vscode.commands.executeCommand('mcp.applyDiff', {
            filePath: testFileName,
            diffs: [
                {
                    startLine: 2,
                    endLine: 2,
                    search: `function c() { return 3; }`,
                    replace: `function c() { return 30; }`
                },
                {
                    startLine: 1,
                    endLine: 1,
                    search: `function b() { return 2; }`,
                    replace: `function b() { return 20; }`
                },
                {
                    startLine: 0,
                    endLine: 0,
                    search: `function a() { return 1; }`,
                    replace: `function a() { return 10; }`
                }
            ]
        });
        
        const modifiedContent = await vscode.workspace.fs.readFile(testFileUri);
        const modifiedText = Buffer.from(modifiedContent).toString('utf8');
        
        assert.ok(modifiedText.includes('return 10;'), 'First function updated');
        assert.ok(modifiedText.includes('return 20;'), 'Second function updated');
        assert.ok(modifiedText.includes('return 30;'), 'Third function updated');
    });
});