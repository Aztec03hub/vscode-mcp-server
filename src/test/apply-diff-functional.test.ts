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
    
    after(() => {
        // Restore original workspace folders
        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            value: originalWorkspaceFolders,
            writable: true
        });
        
        // Clean up test directory
        try {
            if (fs.existsSync(testWorkspaceFolder)) {
                fs.rmSync(testWorkspaceFolder, { recursive: true, force: true });
            }
        } catch (error) {
            console.warn('Failed to clean up test workspace:', error);
        }
    });

    suite('Real Apply Diff Tests', () => {
        let testFilePath: string;
        
        beforeEach(() => {
            testFilePath = path.join(testWorkspaceFolder, 'test-file.ts');
        });
        
        afterEach(() => {
            try {
                if (fs.existsSync(testFilePath)) {
                    fs.unlinkSync(testFilePath);
                }
            } catch (error) {
                // Ignore cleanup errors
            }
        });

        test('Should apply single diff successfully with user approval', async function() {
            this.timeout(10000); // Increase timeout for file operations
            
            // Create test file
            const initialContent = [
                'export class Calculator {',
                '    private result: number = 0;',
                '    ',
                '    add(value: number): void {',
                '        this.result += value;',
                '    }',
                '}'
            ].join('\n');
            
            fs.writeFileSync(testFilePath, initialContent);
            
            // Mock user approval
            const showInformationMessageStub = sinon.stub(vscode.window, 'showInformationMessage');
            showInformationMessageStub.resolves({ title: 'Apply Changes' } as vscode.MessageItem);
            
            const executeCommandStub = sinon.stub(vscode.commands, 'executeCommand');
            executeCommandStub.resolves();
            
            const openTextDocumentStub = sinon.stub(vscode.workspace, 'openTextDocument');
            const mockDocument = {
                getText: () => initialContent,
                lineCount: 7,
                lineAt: (line: number) => ({ 
                    text: initialContent.split('\n')[line] 
                }),
                save: sinon.stub().resolves(),
                uri: vscode.Uri.file(testFilePath)
            };
            openTextDocumentStub.resolves(mockDocument as any);
            
            const showTextDocumentStub = sinon.stub(vscode.window, 'showTextDocument');
            showTextDocumentStub.resolves({} as any);
            
            const applyEditStub = sinon.stub(vscode.workspace, 'applyEdit');
            applyEditStub.resolves(true);
            
            try {
                // Get the apply_diff tool
                const applyDiffTool = mockServer.tools.get('apply_diff');
                assert.strictEqual(applyDiffTool !== undefined, true, 'apply_diff tool should be registered');
                
                // Test data
                const testArgs = {
                    filePath: 'test-file.ts',
                    diffs: [{
                        startLine: 1,
                        endLine: 1,
                        originalContent: '    private result: number = 0;',
                        newContent: '    private result: number = 100;',
                        description: 'Change initial value'
                    }],
                    description: 'Test single diff application'
                };
                
                // Call the tool handler
                const result = await applyDiffTool.handler(testArgs);
                
                // Verify the result
                assert.strictEqual(result.content.length > 0, true, 'Should return content');
                assert.strictEqual(result.content[0].type, 'text', 'Should return text content');
                assert.strictEqual(result.content[0].text.includes('Successfully applied'), true, 'Should indicate success');
                
                // Verify mocks were called appropriately
                assert.strictEqual(openTextDocumentStub.called, true, 'Should open document');
                assert.strictEqual(executeCommandStub.called, true, 'Should execute diff command');
                assert.strictEqual(showInformationMessageStub.called, true, 'Should show approval dialog');
                
            } finally {
                showInformationMessageStub.restore();
                executeCommandStub.restore();
                openTextDocumentStub.restore();
                showTextDocumentStub.restore();
                applyEditStub.restore();
            }
        });

        test('Should reject changes when user cancels', async function() {
            this.timeout(10000);
            
            // Create test file
            const initialContent = 'function test() {\n    return 42;\n}';
            fs.writeFileSync(testFilePath, initialContent);
            
            // Mock user rejection
            const showInformationMessageStub = sinon.stub(vscode.window, 'showInformationMessage');
            showInformationMessageStub.resolves({ title: 'Cancel' } as vscode.MessageItem);
            
            const executeCommandStub = sinon.stub(vscode.commands, 'executeCommand');
            executeCommandStub.resolves();
            
            const openTextDocumentStub = sinon.stub(vscode.workspace, 'openTextDocument');
            const mockDocument = {
                getText: () => initialContent,
                lineCount: 3,
                lineAt: (line: number) => ({ 
                    text: initialContent.split('\n')[line] 
                }),
                uri: vscode.Uri.file(testFilePath)
            };
            openTextDocumentStub.resolves(mockDocument as any);
            
            try {
                const applyDiffTool = mockServer.tools.get('apply_diff');
                
                const testArgs = {
                    filePath: 'test-file.ts',
                    diffs: [{
                        startLine: 0,
                        endLine: 2,
                        originalContent: 'function test() {\n    return 42;\n}',
                        newContent: 'function test() {\n    return 100;\n}',
                        description: 'Change return value'
                    }]
                };
                
                // Should throw error when user cancels
                try {
                    await applyDiffTool.handler(testArgs);
                    assert.fail('Should throw error when user cancels');
                } catch (error: any) {
                    assert.strictEqual(error.message.includes('rejected'), true, 'Should indicate user rejection');
                }
                
            } finally {
                showInformationMessageStub.restore();
                executeCommandStub.restore();
                openTextDocumentStub.restore();
            }
        });

        test('Should handle file not found error', async function() {
            this.timeout(5000);
            
            const applyDiffTool = mockServer.tools.get('apply_diff');
            
            const testArgs = {
                filePath: 'non-existent-file.ts',
                diffs: [{
                    startLine: 0,
                    endLine: 0,
                    originalContent: 'some content',
                    newContent: 'new content'
                }]
            };
            
            // Should throw error for non-existent file
            try {
                await applyDiffTool.handler(testArgs);
                assert.fail('Should throw error for non-existent file');
            } catch (error: any) {
                assert.strictEqual(error.message.includes('Validation failed'), true, 'Should indicate validation failure');
                assert.strictEqual(error.message.includes('does not exist'), true, 'Should mention file does not exist');
            }
        });

        test('Should detect overlapping diff conflicts', async function() {
            this.timeout(5000);
            
            // Create test file
            const initialContent = 'function test() {\n    return 42;\n}';
            fs.writeFileSync(testFilePath, initialContent);
            
            const openTextDocumentStub = sinon.stub(vscode.workspace, 'openTextDocument');
            const mockDocument = {
                getText: () => initialContent,
                lineCount: 3,
                lineAt: (line: number) => ({ 
                    text: initialContent.split('\n')[line] 
                }),
                uri: vscode.Uri.file(testFilePath)
            };
            openTextDocumentStub.resolves(mockDocument as any);
            
            try {
                const applyDiffTool = mockServer.tools.get('apply_diff');
                
                const testArgs = {
                    filePath: 'test-file.ts',
                    diffs: [
                        {
                            startLine: 0,
                            endLine: 2,
                            originalContent: 'function test() {\n    return 42;\n}',
                            newContent: 'function test() {\n    return 100;\n}',
                            description: 'Change entire function'
                        },
                        {
                            startLine: 1,
                            endLine: 1,
                            originalContent: '    return 42;',
                            newContent: '    return 200;',
                            description: 'Change just return statement'
                        }
                    ]
                };
                
                // Should throw error for overlapping diffs
                try {
                    await applyDiffTool.handler(testArgs);
                    assert.fail('Should throw error for overlapping diffs');
                } catch (error: any) {
                    assert.strictEqual(error.message.includes('Validation failed'), true, 'Should indicate validation failure');
                    assert.strictEqual(error.message.includes('overlap'), true, 'Should mention overlap');
                }
                
            } finally {
                openTextDocumentStub.restore();
            }
        });
    });

    suite('Tool Registration Tests', () => {
        test('Should register all required edit tools', () => {
            // Verify all tools are registered
            const expectedTools = ['create_file_code', 'replace_lines_code', 'apply_diff'];
            
            for (const toolName of expectedTools) {
                const tool = mockServer.tools.get(toolName);
                assert.strictEqual(tool !== undefined, true, `Tool ${toolName} should be registered`);
                assert.strictEqual(typeof tool.handler, 'function', `Tool ${toolName} should have a handler function`);
            }
        });

        test('apply_diff tool should have correct schema', () => {
            const applyDiffTool = mockServer.tools.get('apply_diff');
            assert.strictEqual(applyDiffTool !== undefined, true, 'apply_diff tool should exist');
            
            // Check that the schema has the expected properties
            const schema = applyDiffTool.schema;
            assert.strictEqual('filePath' in schema, true, 'Should have filePath parameter');
            assert.strictEqual('diffs' in schema, true, 'Should have diffs parameter');
            assert.strictEqual('description' in schema, true, 'Should have description parameter');
        });
    });
});
