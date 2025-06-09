import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { before, after, beforeEach, afterEach } from 'mocha';
import * as sinon from 'sinon';

// Import the actual apply_diff function for testing
// Since it's not exported, we'll test it through the MCP tool interface
import { registerEditTools, clearFileCache } from '../tools/edit-tools';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { enableTestMode } from '../extension';

suite('Apply Diff Functional Tests', () => {
    let testWorkspaceFolder: string;
    let mockServer: any;
    let originalWorkspaceFolders: readonly vscode.WorkspaceFolder[] | undefined;

    before(async () => {
        // Enable test mode for auto-approval
        enableTestMode();
        console.log('[TEST] Test mode enabled - auto-approval will be active');

        // Create a temporary test workspace
        testWorkspaceFolder = path.join(__dirname, 'temp-workspace');
        if (!fs.existsSync(testWorkspaceFolder)) {
            fs.mkdirSync(testWorkspaceFolder, { recursive: true });
        }

        // Mock workspace folders
        originalWorkspaceFolders = vscode.workspace.workspaceFolders;
        const workspaceFolder: vscode.WorkspaceFolder = {
            uri: vscode.Uri.file(testWorkspaceFolder),
            name: 'test-workspace',
            index: 0
        };

        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            value: [workspaceFolder],
            writable: true
        });

        // Create a mock MCP server to register tools
        mockServer = {
            tools: new Map(),
            tool: function (name: string, description: string, schema: any, handler: any) {
                this.tools.set(name, { name, description, schema, handler });
            }
        };

        // Register the edit tools
        registerEditTools(mockServer as any);
    });

    // Check if auto-approval is enabled and warn the user
    suiteSetup(async function () {
        // Check if the extension is loaded
        const ext = vscode.extensions.getExtension('vscode-mcp-server.vscode-mcp-server');
        if (!ext) {
            console.log('[TEST] Extension not found, tests may fail');
            return;
        }

        // Check auto-approval status
        try {
            const isDiffAutoApprovalEnabled = await vscode.commands.executeCommand('vscode-mcp-server.isDiffAutoApprovalEnabled');
            if (!isDiffAutoApprovalEnabled) {
                console.log('\n[TEST WARNING] Auto-Approval Mode is OFF. Tests will timeout waiting for manual approval.');
                console.log('[TEST WARNING] Please enable Auto-Approval Mode by clicking the status bar button before running tests.\n');

                // Show warning to user
                const result = await vscode.window.showWarningMessage(
                    'Auto-Approval Mode is OFF. Tests will timeout. Enable Auto-Approval Mode for testing?',
                    { modal: true },
                    'Enable Auto-Approval',
                    'Continue Anyway'
                );

                if (result === 'Enable Auto-Approval') {
                    await vscode.commands.executeCommand('vscode-mcp-server.toggleDiffAutoApproval');
                }
            } else {
                console.log('\n[TEST] Auto-Approval Mode is ON. Tests will run without manual intervention.\n');
            }
        } catch (error) {
            console.log('[TEST] Could not check auto-approval status:', error);
        }
    });

    after(async () => {
        // Close all open editors to release file handles
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');

        // Wait a bit for file handles to be released
        await new Promise(resolve => setTimeout(resolve, 100));

        // Clean up test workspace
        if (fs.existsSync(testWorkspaceFolder)) {
            try {
                fs.rmSync(testWorkspaceFolder, { recursive: true, force: true });
            } catch (error) {
                console.log('[TEST] Warning: Could not clean up test workspace:', error);
                // Try again after a longer delay
                await new Promise(resolve => setTimeout(resolve, 500));
                try {
                    fs.rmSync(testWorkspaceFolder, { recursive: true, force: true });
                } catch (retryError) {
                    console.log('[TEST] Warning: Could not clean up test workspace on retry:', retryError);
                }
            }
        }

        // Restore original workspace folders
        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            value: originalWorkspaceFolders,
            writable: true
        });
    });

    suite('Backward Compatibility Tests', () => {
        test('Should work with originalContent/newContent parameters', async () => {
            const testFile = path.join(testWorkspaceFolder, 'backward-compat.ts');
            const initialContent = 'const oldValue = 42;\n';
            fs.writeFileSync(testFile, initialContent);

            const applyDiffTool = mockServer.tools.get('apply_diff');
            assert.ok(applyDiffTool, 'apply_diff tool should be registered');

            // Test with old parameter names
            const result = await applyDiffTool.handler({
                filePath: 'backward-compat.ts',
                diffs: [{
                    startLine: 0,
                    endLine: 0,
                    originalContent: 'const oldValue = 42;',
                    newContent: 'const newValue = 100;'
                }]
            });
            test('Should show deprecation warning for old parameters', async () => {
                const testFile = path.join(testWorkspaceFolder, 'deprecation-test.ts');
                const initialContent = 'test content';

                fs.writeFileSync(testFile, initialContent);

                // Capture all console output
                const originalWarn = console.warn;
                const originalLog = console.log;
                const warnings: string[] = [];
                const logs: string[] = [];

                console.warn = (...args: any[]) => {
                    warnings.push(args.join(' '));
                    originalWarn.apply(console, args);
                };
                console.log = (...args: any[]) => {
                    logs.push(args.join(' '));
                    originalLog.apply(console, args);
                };

                try {
                    const applyDiff = mockServer.tools.get('apply_diff')?.handler;
                    assert.ok(applyDiff, 'apply_diff tool should be registered');

                    // Call with old parameter names
                    await applyDiff({
                        filePath: testFile,
                        diffs: [{
                            startLine: 0,
                            endLine: 0,
                            originalContent: 'test content',
                            newContent: 'updated content'
                        }]
                    });

                    // Check that deprecation warnings were logged (could be in either console.warn or console.log)
                    const allOutput = [...warnings, ...logs].join('\n');
                    assert.ok(allOutput.includes('Deprecation warning'), 'Should show deprecation warning');
                    assert.ok(allOutput.includes('originalContent') && allOutput.includes('deprecated'),
                        'Should warn about originalContent deprecation');
                    assert.ok(allOutput.includes('newContent') && allOutput.includes('deprecated'),
                        'Should warn about newContent deprecation');
                } finally {
                    console.warn = originalWarn;
                    console.log = originalLog;
                }
            });
        });

        suite('New Parameter Tests', () => {
            test('Should work with search/replace parameters', async () => {
                const testFile = path.join(testWorkspaceFolder, 'new-params.ts');
                const initialContent = 'function calculate() { return 42; }';
                fs.writeFileSync(testFile, initialContent);

                const applyDiffTool = mockServer.tools.get('apply_diff');

                // Test with new parameter names
                const result = await applyDiffTool.handler({
                    filePath: 'new-params.ts',
                    description: 'Update calculation',
                    diffs: [{
                        startLine: 0,
                        endLine: 0,
                        search: 'function calculate() { return 42; }',
                        replace: 'function calculate() { return 100; }'
                    }]
                });

                const updatedContent = fs.readFileSync(testFile, 'utf8');
                assert.ok(updatedContent.includes('return 100'), 'File should be updated with new calculation');
            });

            test('Should work with mixed old and new parameters', async () => {
                const testFile = path.join(testWorkspaceFolder, 'mixed-params.ts');
                const initialContent = 'let x = 1;\nlet y = 2;';
                fs.writeFileSync(testFile, initialContent);

                const applyDiffTool = mockServer.tools.get('apply_diff');

                // Mix of old and new parameters
                const result = await applyDiffTool.handler({
                    filePath: 'mixed-params.ts',
                    diffs: [
                        {
                            startLine: 0,
                            endLine: 0,
                            search: 'let x = 1;',
                            replace: 'let x = 10;'
                        },
                        {
                            startLine: 1,
                            endLine: 1,
                            originalContent: 'let y = 2;',
                            newContent: 'let y = 20;'
                        }
                    ]
                });

                const updatedContent = fs.readFileSync(testFile, 'utf8');
                assert.ok(updatedContent.includes('let x = 10'), 'First diff with new params should work');
                assert.ok(updatedContent.includes('let y = 20'), 'Second diff with old params should work');
            });
        });

        suite('File Creation Tests', () => {
            test('Should create file if it does not exist', async () => {
                const testFile = path.join(testWorkspaceFolder, 'new-file.ts');

                // Ensure file doesn't exist
                if (fs.existsSync(testFile)) {
                    fs.unlinkSync(testFile);
                }

                const applyDiffTool = mockServer.tools.get('apply_diff');

                // Apply diff to non-existent file
                const result = await applyDiffTool.handler({
                    filePath: 'new-file.ts',
                    description: 'Create new file with content',
                    diffs: [{
                        startLine: 0,
                        endLine: 0,
                        search: '',
                        replace: 'export function newFunction() {\n    return "created";\n}'
                    }]
                });

                assert.ok(fs.existsSync(testFile), 'File should be created');
                const content = fs.readFileSync(testFile, 'utf8');
                assert.ok(content.includes('export function newFunction'), 'File should contain the new content');
            });

            test('Should handle multiple diffs when creating new file', async () => {
                const testFile = path.join(testWorkspaceFolder, 'multi-diff-new.ts');

                if (fs.existsSync(testFile)) {
                    fs.unlinkSync(testFile);
                }

                const applyDiffTool = mockServer.tools.get('apply_diff');

                // Clear any cached content for this file
                const fileUri = vscode.Uri.file(testFile);
                clearFileCache(fileUri);

                // First, create a file with some initial content to avoid overlap issues
                const result = await applyDiffTool.handler({
                    filePath: 'multi-diff-new.ts',
                    diffs: [
                        {
                            startLine: 0,
                            endLine: 0,
                            search: '',
                            replace: 'import { Component } from "@angular/core";\n\n// Component definition\n\n// Additional code'
                        }
                    ]
                });

                // Wait for file to be written
                await new Promise(resolve => setTimeout(resolve, 200));
                
                // Clear cache again before second operation
                clearFileCache(fileUri);

                // Now apply multiple non-overlapping diffs
                // Note: After the first diff creates 5 lines (0-4), we need to adjust our expectations
                const result2 = await applyDiffTool.handler({
                    filePath: 'multi-diff-new.ts',
                    diffs: [
                        {
                            startLine: 2,
                            endLine: 2,
                            search: '// Component definition',
                            replace: '@Component({\n    selector: "app-test"\n})\nexport class TestComponent {}'
                        },
                        {
                            startLine: 7,  // After first replacement adds 3 lines, this moves from 4 to 7
                            endLine: 7,
                            search: '// Additional code',
                            replace: '// Additional imports\nimport { OnInit } from "@angular/core";'
                        }
                    ]
                });

                // Wait for all file operations to complete
                await new Promise(resolve => setTimeout(resolve, 200));
                
                const content = fs.readFileSync(testFile, 'utf8');
                assert.ok(content.includes('import { Component }'), 'Should have import statement');
                assert.ok(content.includes('@Component'), 'Should have decorator');
                assert.ok(content.includes('export class TestComponent'), 'Should have class declaration');
                assert.ok(content.includes('import { OnInit }'), 'Should have additional import');
            });
        });

        suite('Hierarchical Validation Tests', () => {
            test('Should match content with whitespace differences', async () => {
                const testFile = path.join(testWorkspaceFolder, 'whitespace-test.ts');
                // Content with specific indentation
                const initialContent = 'function test() {\n    return true;\n}';
                fs.writeFileSync(testFile, initialContent);

                const applyDiffTool = mockServer.tools.get('apply_diff');

                // Search with different whitespace
                const result = await applyDiffTool.handler({
                    filePath: 'whitespace-test.ts',
                    diffs: [{
                        startLine: 0,
                        endLine: 2,
                        search: 'function test() {\n  return true;\n}', // Different indentation
                        replace: 'function test() {\n    return false;\n}'
                    }]
                });

                const updatedContent = fs.readFileSync(testFile, 'utf8');
                assert.ok(updatedContent.includes('return false'), 'Should update despite whitespace differences');
            });

            test('Should match content with case differences', async () => {
                const testFile = path.join(testWorkspaceFolder, 'case-test.ts');
                const initialContent = 'const MyVariable = "test";';
                fs.writeFileSync(testFile, initialContent);

                const applyDiffTool = mockServer.tools.get('apply_diff');

                // Search with different case
                const result = await applyDiffTool.handler({
                    filePath: 'case-test.ts',
                    diffs: [{
                        startLine: 0,
                        endLine: 0,
                        search: 'const myvariable = "test";', // Different case
                        replace: 'const MyVariable = "updated";'
                    }]
                });

                const updatedContent = fs.readFileSync(testFile, 'utf8');
                assert.ok(updatedContent.includes('"updated"'), 'Should update despite case differences');
            });

            test('Should use line hints for faster matching', async () => {
                const testFile = path.join(testWorkspaceFolder, 'line-hint-test.ts');
                const lines = [];
                for (let i = 0; i < 100; i++) {
                    lines.push(`const line${i} = ${i};`);
                }
                fs.writeFileSync(testFile, lines.join('\n'));

                const applyDiffTool = mockServer.tools.get('apply_diff');

                // Should find the line quickly with hint
                const result = await applyDiffTool.handler({
                    filePath: 'line-hint-test.ts',
                    diffs: [{
                        startLine: 50,
                        endLine: 50,
                        search: 'const line50 = 50;',
                        replace: 'const line50 = 500; // Updated'
                    }]
                });

                const updatedContent = fs.readFileSync(testFile, 'utf8');
                assert.ok(updatedContent.includes('const line50 = 500; // Updated'), 'Should update the correct line');
            });
        });

        suite('Error Handling Tests', () => {
            test('Should fail when neither search/originalContent nor replace/newContent provided', async () => {
                const testFile = path.join(testWorkspaceFolder, 'error-test.ts');
                fs.writeFileSync(testFile, 'test');

                const applyDiffTool = mockServer.tools.get('apply_diff');

                try {
                    await applyDiffTool.handler({
                        filePath: 'error-test.ts',
                        diffs: [{
                            startLine: 0,
                            endLine: 0
                            // Missing both search/originalContent and replace/newContent
                        }]
                    });
                    assert.fail('Should throw an error for missing parameters');
                } catch (error: any) {
                    assert.ok(error.message.includes('missing required'), 'Should indicate missing parameters');
                    assert.ok(error.message.includes('search') || error.message.includes('replace'), 'Should mention the missing parameter');
                }
            });

            test('Should provide detailed error when content not found', async () => {
                const testFile = path.join(testWorkspaceFolder, 'not-found-test.ts');
                fs.writeFileSync(testFile, 'actual content in file');

                const applyDiffTool = mockServer.tools.get('apply_diff');

                try {
                    await applyDiffTool.handler({
                        filePath: 'not-found-test.ts',
                        diffs: [{
                            startLine: 0,
                            endLine: 0,
                            search: 'content that does not exist',
                            replace: 'new content'
                        }]
                    });
                    assert.fail('Should throw an error when content not found');
                } catch (error: any) {
                    assert.ok(error.message.includes('Validation failed'), 'Should indicate validation failed');
                    assert.ok(error.message.includes('Check if the code has been modified') ||
                        error.message.includes('not found'),
                        'Should provide helpful suggestion');
                }
            });
        });
    });

    suite('Full File Replacement Tests (endLine: -1)', () => {
        test('Should replace entire file when endLine: -1 with empty search', async () => {
            const testFile = path.join(testWorkspaceFolder, 'full-replace-empty.ts');
            const initialContent = `line 1
        line 2
        line 3
        line 4`;
            fs.writeFileSync(testFile, initialContent);
            clearFileCache(vscode.Uri.file(testFile)); // Clear cache before test

            const applyDiffTool = mockServer.tools.get('apply_diff');

            await applyDiffTool.handler({
                filePath: 'full-replace-empty.ts',
                description: 'Replace entire file',
                diffs: [{
                    startLine: 0,
                    endLine: -1,
                    search: '',
                    replace: 'completely new content\nwith multiple lines\nreplacing everything'
                }]
            });

            const updatedContent = fs.readFileSync(testFile, 'utf8');
            assert.strictEqual(
                updatedContent,
                'completely new content\nwith multiple lines\nreplacing everything',
                'Should replace entire file with new content'
            );
        });

        test('Should replace from startLine to end when endLine: -1', async () => {
            const testFile = path.join(testWorkspaceFolder, 'partial-replace.ts');
            const initialContent = `keep this line
        line 2
        line 3
        line 4`;
            fs.writeFileSync(testFile, initialContent);
            clearFileCache(vscode.Uri.file(testFile));

            const applyDiffTool = mockServer.tools.get('apply_diff');

            await applyDiffTool.handler({
                filePath: 'partial-replace.ts',
                description: 'Replace from line 1 to end',
                diffs: [{
                    startLine: 1,
                    endLine: -1,
                    search: '',
                    replace: 'new line 2\nnew line 3'
                }]
            });

            const updatedContent = fs.readFileSync(testFile, 'utf8');
            assert.strictEqual(
                updatedContent,
                'keep this line\nnew line 2\nnew line 3',
                'Should keep first line and replace rest'
            );
        });

        test('Should work with endLine: -1 on new file', async () => {
            const testFile = path.join(testWorkspaceFolder, 'new-file-replace.ts');
            // Don't create the file - it should be created by apply_diff
            // File doesn't exist yet, no need to clear cache

            const applyDiffTool = mockServer.tools.get('apply_diff');

            await applyDiffTool.handler({
                filePath: 'new-file-replace.ts',
                description: 'Create new file with full replacement',
                diffs: [{
                    startLine: 0,
                    endLine: -1,
                    search: '',
                    replace: 'new file content\ncreated with endLine: -1'
                }]
            });

            assert.ok(fs.existsSync(testFile), 'File should be created');
            const content = fs.readFileSync(testFile, 'utf8');
            // Normalize line endings for cross-platform compatibility
            const normalizedContent = content.replace(/\r\n/g, '\n');
            assert.strictEqual(
                normalizedContent,
                'new file content\ncreated with endLine: -1',
                'Should create file with specified content'
            );
        });

        test('Should validate search content with endLine: -1', async () => {
            const testFile = path.join(testWorkspaceFolder, 'validate-replace.ts');
            const initialContent = `function test() {
    return "hello";
        }`;
            fs.writeFileSync(testFile, initialContent);
            clearFileCache(vscode.Uri.file(testFile));

            const applyDiffTool = mockServer.tools.get('apply_diff');

            // This should work - search content matches from startLine to end
            await applyDiffTool.handler({
                filePath: 'validate-replace.ts',
                description: 'Replace with validation',
                diffs: [{
                    startLine: 1,
                    endLine: -1,
                    search: '    return "hello";\n}',
                    replace: '    return "world";\n}'
                }]
            });

            const updatedContent = fs.readFileSync(testFile, 'utf8');
            assert.strictEqual(
                updatedContent,
                'function test() {\n    return "world";\n}',
                'Should replace content from line 1 to end'
            );
        });

        test('Should fail when search content does not match with endLine: -1', async () => {
            const testFile = path.join(testWorkspaceFolder, 'fail-validate.ts');
            const initialContent = `function test() {
    return "hello";
        }`;
            fs.writeFileSync(testFile, initialContent);
            clearFileCache(vscode.Uri.file(testFile));

            const applyDiffTool = mockServer.tools.get('apply_diff');

            try {
                await applyDiffTool.handler({
                    filePath: 'fail-validate.ts',
                    description: 'Should fail validation',
                    diffs: [{
                        startLine: 0,
                        endLine: -1,
                        search: 'wrong content that does not match',
                        replace: 'replacement content'
                    }]
                });
                assert.fail('Should throw an error when search content does not match');
            } catch (error: any) {
                assert.ok(
                    error.message.includes('Validation failed') || 
                    error.message.includes('Full file replacement search content'),
                    'Should indicate validation failed for full file replacement'
                );
            }
        });

        test('Should handle multiple diffs with endLine: -1', async () => {
            const testFile = path.join(testWorkspaceFolder, 'multi-replace.ts');
            const initialContent = `// header comment
        function test1() {
    return 1;
        }

        function test2() {
    return 2;
        }`;
            fs.writeFileSync(testFile, initialContent);
            clearFileCache(vscode.Uri.file(testFile));

            const applyDiffTool = mockServer.tools.get('apply_diff');

            // Note: Multiple endLine: -1 diffs would conflict, so this tests the conflict resolution
            try {
                await applyDiffTool.handler({
                    filePath: 'multi-replace.ts',
                    description: 'Multiple full replacements should conflict',
                    diffs: [
                        {
                            startLine: 0,
                            endLine: -1,
                            search: '',
                            replace: 'first replacement'
                        },
                        {
                            startLine: 1,
                            endLine: -1,
                            search: '',
                            replace: 'second replacement'
                        }
                    ]
                });
                assert.fail('Should handle conflicts between multiple endLine: -1 diffs');
            } catch (error: any) {
                // This is expected - multiple full file replacements should conflict
                assert.ok(
                    error.message.includes('conflict') || error.message.includes('Validation failed'),
                    'Should detect conflict between multiple full file replacements'
                );
            }
        });
    });
        });
