import { suite, test, before, after, afterEach } from 'mocha';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as assert from 'assert';
import { enableTestMode } from '../extension';
import { clearFileCache } from '../tools/edit-tools';

// Test edge cases and special scenarios
suite('Edge Cases Tests', () => {
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
        testWorkspaceFolder = path.join(__dirname, 'temp-workspace-edge');
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
    
    afterEach(async () => {
        // Ensure clean state between tests
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Clear any cached content
        if (testFileUri) {
            clearFileCache(testFileUri);
        }
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
    
    test('Empty file handling', async () => {
        // Create empty file
        await createTestFile('', 'test-empty-file.ts');
        
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
        await createTestFile('single line', 'test-single-line.ts');
        
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
        await createTestFile(contentWithoutNewline, 'test-no-newline.ts');
        
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
        await createTestFile(content, 'test-long-lines.ts');
        
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
        
        await createTestFile(unicodeContent, 'test-unicode.ts');
        
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
    
    test('Multi-line indentation removal - should respect intentional indent changes', async () => {
        // This test verifies that when the user explicitly removes indentation across
        // multiple lines, ALL lines are updated, not just the first one.
        // Bug: Previously only the first line's indentation was changed because the
        // fuzzy matcher was "preserving relative indentation" from the original file.
        
        const indentedContent = `## Section Header

        \`\`\`
    indented line 1
    indented line 2
    indented line 3
    indented line 4
        \`\`\``;
        
        await createTestFile(indentedContent, 'test-indent-removal.md');
        
        // Apply diff that explicitly removes indentation from all lines
        const result = await vscode.commands.executeCommand('mcp.applyDiff', {
            filePath: testFileName,
            diffs: [{
                startLine: 3,
                endLine: 6,
                search: '    indented line 1\n    indented line 2\n    indented line 3\n    indented line 4',
                replace: 'unindented line 1\nunindented line 2\nunindented line 3\nunindented line 4'
            }]
        });
        
        const content = await vscode.workspace.fs.readFile(testFileUri);
        const text = Buffer.from(content).toString('utf8');
        
        // Verify ALL lines had their indentation removed
        assert.ok(text.includes('unindented line 1'), 'First line should be unindented');
        assert.ok(text.includes('unindented line 2'), 'Second line should be unindented');
        assert.ok(text.includes('unindented line 3'), 'Third line should be unindented');
        assert.ok(text.includes('unindented line 4'), 'Fourth line should be unindented');
        
        // Verify no lines still have the original 4-space indentation
        assert.ok(!text.includes('    unindented line'), 'No lines should have indentation added back');
        assert.ok(!text.includes('    indented line'), 'No original indented lines should remain');
    });
    
    test('Multi-line indentation change - should preserve intentional indent modifications', async () => {
        // Test changing indentation from 4 spaces to 2 spaces across multiple lines
        
        const content4Spaces = `function test() {
    line1;
    line2;
    line3;
        }`;
        
        await createTestFile(content4Spaces, 'test-indent-change.ts');
        
        // Change 4-space indent to 2-space indent
        const result = await vscode.commands.executeCommand('mcp.applyDiff', {
            filePath: testFileName,
            diffs: [{
                startLine: 1,
                endLine: 3,
                search: '    line1;\n    line2;\n    line3;',
                replace: '  line1;\n  line2;\n  line3;'
            }]
        });
        
        const content = await vscode.workspace.fs.readFile(testFileUri);
        const text = Buffer.from(content).toString('utf8');
        const lines = text.split('\n');
        
        // Verify all lines use 2-space indentation (not 4-space)
        assert.ok(lines[1].startsWith('  line1;'), 'Line 1 should have 2-space indent');
        assert.ok(lines[2].startsWith('  line2;'), 'Line 2 should have 2-space indent');
        assert.ok(lines[3].startsWith('  line3;'), 'Line 3 should have 2-space indent');
        
        // Verify no 4-space indentation was preserved
        assert.ok(!lines[1].startsWith('    '), 'Line 1 should not have 4-space indent');
        assert.ok(!lines[2].startsWith('    '), 'Line 2 should not have 4-space indent');
        assert.ok(!lines[3].startsWith('    '), 'Line 3 should not have 4-space indent');
    });
        });