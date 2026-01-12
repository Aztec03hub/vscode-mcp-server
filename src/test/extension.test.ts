import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as proxyquireLib from 'proxyquire';
import { createMockContext } from './testUtils';

// Configure proxyquire
const proxyquire = proxyquireLib.noPreserveCache().noCallThru();

suite('Extension Test Suite', () => {
    let mockMCPServer: any;
    let MockServerConstructor: sinon.SinonStub;
    let extension: any;
    let workspaceConfig: any;
    let statusBarItem: any;
    let context: any; // Changed type to any to avoid type errors
    let getConfigurationStub: sinon.SinonStub;
    let createStatusBarItemStub: sinon.SinonStub;
    let registerCommandStub: sinon.SinonStub;
    let onDidChangeConfigurationStub: sinon.SinonStub;
    let globalState: any;

    setup(() => {
        // Create mock MCPServer
        mockMCPServer = {
            start: sinon.stub().resolves(),
            stop: sinon.stub().resolves(),
            setFileListingCallback: sinon.spy(),
            setupTools: sinon.spy()
        };
        
        // Mock constructor for MCPServer
        MockServerConstructor = sinon.stub().returns(mockMCPServer);
        
        // Load extension with mocked dependencies
        extension = proxyquire('../extension', {
            './server': { MCPServer: MockServerConstructor }
        });
        
        // Create mock status bar item (only one main menu button now)
        statusBarItem = {
            text: '',
            tooltip: '',
            command: '',
            show: sinon.spy(),
            dispose: sinon.spy(),
            backgroundColor: undefined
        };
        
        // Mock vscode.window.createStatusBarItem to return the main menu button
        createStatusBarItemStub = sinon.stub(vscode.window, 'createStatusBarItem');
        createStatusBarItemStub.returns(statusBarItem);
        
        // Mock configuration
        workspaceConfig = {
            get: sinon.stub()
        };
        workspaceConfig.get.withArgs('port').returns(4321);
        workspaceConfig.get.withArgs('defaultEnabled').returns(true); // Enable server by default for tests
        getConfigurationStub = sinon.stub(vscode.workspace, 'getConfiguration').returns(workspaceConfig);
        
        // Create mock global state
        globalState = {
            get: sinon.stub(),
            update: sinon.stub().resolves()
        };
        globalState.get.withArgs('mcpServerEnabled').returns(true);
        globalState.get.withArgs('diffAutoApprovalEnabled').returns(false);
        globalState.get.withArgs('shellAutoApprovalEnabled').returns(false);
        
        // Create a mocked extension context
        context = createMockContext();
        context.globalState = globalState;
        
        // Mock command registration
        registerCommandStub = sinon.stub(vscode.commands, 'registerCommand').returns({
            dispose: sinon.spy()
        });
        
        // Mock onDidChangeConfiguration
        onDidChangeConfigurationStub = sinon.stub(vscode.workspace, 'onDidChangeConfiguration').returns({
            dispose: sinon.spy()
        });
    });

    teardown(() => {
        // Restore all sinon stubs and mocks after each test
        sinon.restore();
    });

    test('Extension should read port from configuration', async () => {
        // Activate the extension
        await extension.activate(context);
        
        // Check that configuration was accessed
        assert.strictEqual(getConfigurationStub.called, true, 'Configuration not accessed');
        assert.strictEqual(workspaceConfig.get.calledWith('port'), true, 'Port not read from configuration');
        
        // Check that MCPServer was created with configured port (when server is enabled)
        // Find the call with the correct port and terminal
        const serverCreated = MockServerConstructor.getCalls().some(call => call.args[0] === 4321);
        assert.strictEqual(serverCreated, true, 'MCPServer not created with configured port');
    });

    test('Status bar item should be created with proper attributes', async () => {
        // Activate the extension
        await extension.activate(context);
        
        // Verify status bar was created
        assert.strictEqual(createStatusBarItemStub.called, true, 'Status bar item not created');
        
        // Check the status bar attributes - command should be showStickyMenu (for the new menu)
        assert.strictEqual(statusBarItem.command, 'vscode-mcp-server.showStickyMenu', 'Status bar command not set correctly');
        assert.strictEqual(statusBarItem.show.called, true, 'Status bar not shown');
        
        // Check that the text contains MCP Server (when server is enabled)
        assert.strictEqual(statusBarItem.text.includes('MCP Server'), true, 'Status bar does not show MCP Server text');
    });

    test('Server info command should be registered', async () => {
        // Activate the extension
        await extension.activate(context);
        
        // Check that the command was registered
        const showServerInfoCall = registerCommandStub.getCalls().find(
            call => call.args[0] === 'vscode-mcp-server.showServerInfo'
        );
        assert.strictEqual(showServerInfoCall !== undefined, true, 'Server info command not registered');
    });

    test('Commands should be registered properly', async () => {
        // Activate the extension  
        await extension.activate(context);
        
        // Check that the required commands were registered
        const toggleServerCall = registerCommandStub.getCalls().find(
            call => call.args[0] === 'vscode-mcp-server.toggleServer'
        );
        assert.strictEqual(toggleServerCall !== undefined, true, 'Toggle server command not registered');
        
        const toggleDiffAutoApprovalCall = registerCommandStub.getCalls().find(
            call => call.args[0] === 'vscode-mcp-server.toggleDiffAutoApproval'
        );
        assert.strictEqual(toggleDiffAutoApprovalCall !== undefined, true, 'Toggle auto-approval command not registered');
    });

    test('Deactivate should clean up resources', async () => {
        // First activate to set up resources
        await extension.activate(context);
        
        // Then deactivate
        await extension.deactivate();
        
        // Check that the main menu button was disposed
        assert.strictEqual(statusBarItem.dispose.called, true, 'Status bar not disposed during deactivation');
        
        // Check that server was stopped (if it was created)
        if (MockServerConstructor.called) {
            assert.strictEqual(mockMCPServer.stop.called, true, 'Server not stopped during deactivation');
        }
    });
});