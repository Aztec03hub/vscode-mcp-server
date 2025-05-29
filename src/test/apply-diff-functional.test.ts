import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { before, after, beforeEach, afterEach } from 'mocha';
import * as sinon from 'sinon';

// Import the actual apply_diff function for testing
// Since it's not exported, we'll test it through the MCP tool interface
import { registerEditTools } from '../tools/edit-tools';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

suite('Apply Diff Functional Tests', () => {
    let testWorkspaceFolder: string;
    let mockServer: any;
    let originalWorkspaceFolders: readonly vscode.WorkspaceFolder[] | undefined;
    
    before(async () => {
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
            tool: function(name: string, description: string, schema: any, handler: any) {
                this.tools.set(name, { name, description, schema, handler });
            }
        };
        
        // Register the edit tools
        registerEditTools(mockServer as any);
    });
    
    // Check if auto-approval is enabled and warn the user
    suiteSetup(async function() {
        // Check if the extension is loaded
        const ext = vscode.extensions.getExtension('vscode-mcp-server.vscode-mcp-server');
        if (!ext) {
            console.log('[TEST] Extension not found, tests may fail');
            return;
        }
        
        // Check auto-approval status
        try {
            const isAutoApprovalEnabled = await vscode.commands.executeCommand('vscode-mcp-server.isAutoApprovalEnabled');
            if (!isAutoApprovalEnabled) {
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
                    await vscode.commands.executeCommand('vscode-mcp-server.toggleAutoApproval');
                }
            } else {
                console.log('\n[TEST] Auto-Approval Mode is ON. Tests will run without manual intervention.\n');
            }
        } catch (error) {
            console.log('[TEST] Could not check auto-approval status:', error);
        }
    });
    
    after(() => {
        // Clean up test workspace
        if (fs.existsSync(testWorkspaceFolder)) {
            fs.rmSync(testWorkspaceFolder, { recursive: true, force: true });
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
            
            // Verify the change was applied
            const updatedContent = fs.readFileSync(testFile, 'utf8');
            assert.ok(updatedContent.includes('const newValue = 100;'), 'File should be updated with new content');
        });
        
        test('Should show deprecation warning for old parameters', async () => {
            const consoleWarnStub = sinon.stub(console, 'warn');
            
            try {
                const testFile = path.join(testWorkspaceFolder, 'deprecation-test.ts');
                fs.writeFileSync(testFile, 'test content');
                
                const applyDiffTool = mockServer.tools.get('apply_diff');
                await applyDiffTool.handler({
                    filePath: 'deprecation-test.ts',
                    diffs: [{
                        startLine: 0,
                        endLine: 0,
                        originalContent: 'test content',
                        newContent: 'updated content'
                    }]
                });
                
                // Check that deprecation warnings were logged
                assert.ok(consoleWarnStub.called, 'Should show deprecation warning');
                assert.ok(consoleWarnStub.calledWithMatch(/deprecation warning.*originalContent/i), 
                    'Should warn about originalContent deprecation');
                assert.ok(consoleWarnStub.calledWithMatch(/deprecation warning.*newContent/i), 
                    'Should warn about newContent deprecation');
            } finally {
                consoleWarnStub.restore();
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
            
            const result = await applyDiffTool.handler({
                filePath: 'multi-diff-new.ts',
                diffs: [
                    {
                        startLine: 0,
                        endLine: 0,
                        search: '',
                        replace: 'import { Component } from "@angular/core";\n'
                    },
                    {
                        startLine: 1,
                        endLine: 1,
                        search: '',
                        replace: '\n@Component({\n    selector: "app-test"\n})\nexport class TestComponent {}'
                    }
                ]
            });
            
            const content = fs.readFileSync(testFile, 'utf8');
            assert.ok(content.includes('import { Component }'), 'Should have import statement');
            assert.ok(content.includes('@Component'), 'Should have decorator');
            assert.ok(content.includes('export class TestComponent'), 'Should have class declaration');
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
                assert.ok(error.message.includes('must be provided'), 'Should indicate missing parameters');
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
                assert.ok(error.message.includes('Could not find content'), 'Should indicate content not found');
            }
        });
    });
});
