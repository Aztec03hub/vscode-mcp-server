import * as assert from 'assert';
import { suite, test, before, after } from 'mocha';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// Test edge cases and boundary conditions
suite('Edge Cases Tests', () => {
    let workspaceFolder: vscode.WorkspaceFolder;
    let testFileUri: vscode.Uri;
    const testFileName = 'edge-cases-test.txt';
    
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
    
    test('Empty file handling', async () => {
        // Create empty file
        await vscode.workspace.fs.writeFile(testFileUri, Buffer.from(''));
        
        // Try to apply diff to empty file
        const result = await vscode.commands.executeCommand('mcp.applyDiff', {
            filePath: testFileName,
            diffs: [{
                startLine: 0,
                endLine: 0,
                search: '',
                replace: 'First line added to empty file'
            }]
        });
        
        const content = await vscode.workspace.fs.readFile(testFileUri);
        const text = Buffer.from(content).toString('utf8');
        
        assert.strictEqual(text, 'First line added to empty file', 'Should add content to empty file');
    });
    
    test('Single line file', async () => {
        await vscode.workspace.fs.writeFile(testFileUri, Buffer.from('single line'));
        
        const result = await vscode.commands.executeCommand('mcp.applyDiff', {
            filePath: testFileName,
            diffs: [{
                startLine: 0,
                endLine: 0,
                search: 'single line',
                replace: 'modified single line'
            }]
        });
        
        const content = await vscode.workspace.fs.readFile(testFileUri);
        const text = Buffer.from(content).toString('utf8');
        
        assert.strictEqual(text, 'modified single line', 'Should handle single line files');
    });
    
    test('File with no newline at end', async () => {
        // Create file without trailing newline
        const contentWithoutNewline = 'line1\nline2\nlast line without newline';
        await vscode.workspace.fs.writeFile(testFileUri, Buffer.from(contentWithoutNewline));
        
        const result = await vscode.commands.executeCommand('mcp.applyDiff', {
            filePath: testFileName,
            diffs: [{
                startLine: 2,
                endLine: 2,
                search: 'last line without newline',
                replace: 'last line with modification'
            }]
        });
        
        const content = await vscode.workspace.fs.readFile(testFileUri);
        const text = Buffer.from(content).toString('utf8');
        
        assert.ok(text.includes('last line with modification'), 'Should handle files without trailing newline');
    });
    
    test('Very long lines', async () => {
        // Create file with very long line (1000 characters)
        const longLine = 'x'.repeat(1000);
        const content = `short line\n${longLine}\nanother short line`;
        await vscode.workspace.fs.writeFile(testFileUri, Buffer.from(content));
        
        const result = await vscode.commands.executeCommand('mcp.applyDiff', {
            filePath: testFileName,
            diffs: [{
                startLine: 1,
                endLine: 1,
                search: longLine,
                replace: 'y'.repeat(1000)
            }]
        });
        
        const modifiedContent = await vscode.workspace.fs.readFile(testFileUri);
        const modifiedText = Buffer.from(modifiedContent).toString('utf8');
        
        assert.ok(modifiedText.includes('y'.repeat(1000)), 'Should handle very long lines');
        assert.ok(modifiedText.includes('short line'), 'Should preserve other lines');
    });
    
    test('Unicode and special characters', async () => {
        const unicodeContent = `// 日本語コメント\nconst emoji = "🎉🚀💻";\nconst special = "\t\r\n\"\\\'"\;\n/* мультиязычный комментарий */`;
        
        await vscode.workspace.fs.writeFile(testFileUri, Buffer.from(unicodeContent));
        
        const result = await vscode.commands.executeCommand('mcp.applyDiff', {
            filePath: testFileName,
            diffs: [{
                startLine: 1,
                endLine: 1,
                search: 'const emoji = "🎉🚀💻";',
                replace: 'const emoji = "🌟✨🎯";'
            }]
        });
        
        const content = await vscode.workspace.fs.readFile(testFileUri);
        const text = Buffer.from(content).toString('utf8');
        
        assert.ok(text.includes('🌟✨🎯'), 'Should handle Unicode characters');
        assert.ok(text.includes('日本語コメント'), 'Should preserve other Unicode content');
    });
});