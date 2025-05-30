import { suite, test, before, after } from 'mocha';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as assert from 'assert';
import { enableTestMode } from '../extension';
import { clearFileCache } from '../tools/edit-tools';

// Integration tests for complete workflows
suite('Apply Diff Integration Tests', () => {
    let testWorkspaceFolder: string;
    let workspaceFolder: vscode.WorkspaceFolder;
    const testProjectDir = 'test-project';
    let projectUri: vscode.Uri;
    let originalWorkspaceFolders: readonly vscode.WorkspaceFolder[] | undefined;
    
    // Helper to create a fresh test file before each test
    async function createProjectFile(filename: string, content: string) {
        // Close any open editors first to ensure clean state
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const fileUri = vscode.Uri.joinPath(projectUri, filename);
        // Clear the cache for this file to ensure fresh read
        clearFileCache(fileUri);
        await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content));
        // Give VS Code time to process the file creation
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    before(async () => {
        // Enable test mode for auto-approval
        enableTestMode();
        
        // Create a temporary test workspace
        testWorkspaceFolder = path.join(__dirname, 'temp-workspace-integration');
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
        
        projectUri = vscode.Uri.joinPath(workspaceFolder.uri, testProjectDir);
        
        // Create test project structure
        await vscode.workspace.fs.createDirectory(projectUri);
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
    
    test('Complete TypeScript refactoring workflow', async () => {
        // Create a TypeScript file
        const tsFile = 'user.service.ts';
        const tsFileUri = vscode.Uri.joinPath(projectUri, tsFile);
        const originalCode = `export class UserService {
    private users: User[] = [];
    
    constructor() {
        this.loadUsers();
    }
    
    private loadUsers(): void {
        // Load users from database
        console.log("Loading users...");
    }
    
    public getUsers(): User[] {
        return this.users;
    }
    
    public addUser(user: User): void {
        this.users.push(user);
    }
}

interface User {
    id: number;
    name: string;
    email: string;
}`;
        
        await createProjectFile(tsFile, originalCode);
        
        // Apply multiple refactoring changes
        const result = await vscode.commands.executeCommand('mcp.applyDiff', {
            filePath: path.join(testProjectDir, tsFile),
            description: 'Refactor UserService to use async/await and add validation',
            diffs: [
                {
                    startLine: 7,
                    endLine: 10,
                    search: `    private loadUsers(): void {
        // Load users from database
        console.log("Loading users...");
    }`,
                    replace: `    private async loadUsers(): Promise<void> {
        // Load users from database
        console.log("Loading users...");
        try {
            const response = await fetch('/api/users');
            this.users = await response.json();
        } catch (error) {
            console.error('Failed to load users:', error);
        }
    }`
                },
                {
                    startLine: 15,
                    endLine: 17,
                    search: `    public addUser(user: User): void {
        this.users.push(user);
    }`,
                    replace: `    public addUser(user: User): void {
        if (!user.email || !user.name) {
            throw new Error('User must have name and email');
        }
        this.users.push(user);
        console.log(\`User \${user.name} added successfully\`);
    }`
                },
                {
                    startLine: 22,
                    endLine: 24,
                    search: `    id: number;
    name: string;
    email: string;`,
                    replace: `    id: number;
    name: string;
    email: string;
    createdAt?: Date;
    updatedAt?: Date;`
                }
            ]
        });
        
        // Verify all changes were applied
        const modifiedContent = await vscode.workspace.fs.readFile(tsFileUri);
        const modifiedText = Buffer.from(modifiedContent).toString('utf8');
        
        assert.ok(modifiedText.includes('async loadUsers(): Promise<void>'), 'Method should be async');
        assert.ok(modifiedText.includes('await fetch'), 'Should use fetch API');
        assert.ok(modifiedText.includes('throw new Error'), 'Should have validation');
        assert.ok(modifiedText.includes('createdAt?: Date'), 'Should have new fields');
    });
    
    test('JSON configuration update workflow', async () => {
        // Create a package.json file
        const jsonFile = 'package.json';
        const jsonFileUri = vscode.Uri.joinPath(projectUri, jsonFile);
        const originalJson = `{
  "name": "test-project",
  "version": "1.0.0",
  "description": "Test project",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "test": "echo \"No tests\""
  },
  "dependencies": {
    "express": "^4.17.1"
  }
}`;
        
        await createProjectFile(jsonFile, originalJson);
        
        // Update JSON configuration
        const result = await vscode.commands.executeCommand('mcp.applyDiff', {
            filePath: path.join(testProjectDir, jsonFile),
            description: 'Update package.json with new scripts and dependencies',
            diffs: [
                {
                    startLine: 5,
                    endLine: 8,
                    search: `  "scripts": {
    "start": "node index.js",
    "test": "echo \"No tests\""
  },`,
                    replace: `  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js",
    "test": "jest",
    "lint": "eslint ."
  },`
                },
                {
                    startLine: 9,
                    endLine: 11,
                    search: `  "dependencies": {
    "express": "^4.17.1"
  }`,
                    replace: `  "dependencies": {
    "express": "^4.18.2",
    "dotenv": "^16.0.3"
  },
  "devDependencies": {
    "jest": "^29.0.0",
    "eslint": "^8.0.0",
    "nodemon": "^2.0.0"
  }`
                }
            ]
        });
        
        // Verify JSON is still valid
        const modifiedContent = await vscode.workspace.fs.readFile(jsonFileUri);
        const modifiedText = Buffer.from(modifiedContent).toString('utf8');
        
        // Parse JSON to ensure it's valid
        const parsedJson = JSON.parse(modifiedText);
        assert.ok(parsedJson.scripts.dev, 'Should have dev script');
        assert.ok(parsedJson.scripts.lint, 'Should have lint script');
        assert.ok(parsedJson.devDependencies, 'Should have devDependencies');
        assert.strictEqual(parsedJson.dependencies.express, '^4.18.2', 'Express should be updated');
    });
    
    test('Multi-file refactoring workflow', async () => {
        // Create multiple related files
        const files = [
            {
                name: 'math.js',
                content: `function add(a, b) {
    return a + b;
}

function subtract(a, b) {
    return a - b;
}

module.exports = { add, subtract };`
            },
            {
                name: 'calculator.js',
                content: `const { add, subtract } = require('./math');

function calculate(op, a, b) {
    if (op === 'add') return add(a, b);
    if (op === 'subtract') return subtract(a, b);
    throw new Error('Unknown operation');
}

module.exports = { calculate };`
            },
            {
                name: 'index.js',
                content: `const { calculate } = require('./calculator');

console.log(calculate('add', 5, 3));
console.log(calculate('subtract', 10, 4));`
            }
        ];
        
        // Create all files
        for (const file of files) {
            const fileUri = vscode.Uri.joinPath(projectUri, file.name);
            await createProjectFile(file.name, file.content);
        }
        
        // Refactor to ES6 modules - one file at a time
        // First, update math.js
        await vscode.commands.executeCommand('mcp.applyDiff', {
            filePath: path.join(testProjectDir, 'math.js'),
            diffs: [{
                startLine: 0,
                endLine: 8,
                search: files[0].content,
                replace: `export function add(a, b) {
    return a + b;
}

export function subtract(a, b) {
    return a - b;
}`
            }]
        });
        
        // Then update calculator.js
        await vscode.commands.executeCommand('mcp.applyDiff', {
            filePath: path.join(testProjectDir, 'calculator.js'),
            diffs: [{
                startLine: 0,
                endLine: 8,
                search: files[1].content,
                replace: `import { add, subtract } from './math.js';

export function calculate(op, a, b) {
    if (op === 'add') return add(a, b);
    if (op === 'subtract') return subtract(a, b);
    throw new Error('Unknown operation');
}`
            }]
        });
        
        // Finally update index.js
        await vscode.commands.executeCommand('mcp.applyDiff', {
            filePath: path.join(testProjectDir, 'index.js'),
            diffs: [{
                startLine: 0,
                endLine: 3,
                search: files[2].content,
                replace: `import { calculate } from './calculator.js';

console.log(calculate('add', 5, 3));
console.log(calculate('subtract', 10, 4));`
            }]
        });
        
        // Verify all files were updated
        for (const file of files) {
            const fileUri = vscode.Uri.joinPath(projectUri, file.name);
            const content = await vscode.workspace.fs.readFile(fileUri);
            const text = Buffer.from(content).toString('utf8');
            
            if (file.name === 'math.js') {
                assert.ok(text.includes('export function'), 'math.js should use ES6 exports');
            } else if (file.name === 'calculator.js') {
                assert.ok(text.includes('import { add, subtract }'), 'calculator.js should use ES6 imports');
            } else if (file.name === 'index.js') {
                assert.ok(text.includes('import { calculate }'), 'index.js should use ES6 imports');
            }
        }
    });
    
    test('Error recovery and partial success workflow', async () => {
        const errorTestFile = 'error-test.js';
        const errorTestUri = vscode.Uri.joinPath(projectUri, errorTestFile);
        const originalContent = `function one() { return 1; }
function two() { return 2; }
function three() { return 3; }`;
        
        await createProjectFile(errorTestFile, originalContent);
        
        // Apply mix of valid and invalid changes with partial success
        const result = await vscode.commands.executeCommand('mcp.applyDiff', {
            filePath: path.join(testProjectDir, errorTestFile),
            partialSuccess: true,
            diffs: [
                {
                    startLine: 0,
                    endLine: 0,
                    search: 'function one() { return 1; }',
                    replace: 'const one = () => 1;'
                },
                {
                    startLine: 1,
                    endLine: 1,
                    search: 'function invalid() { return 0; }',  // This doesn't exist
                    replace: 'const invalid = () => 0;'
                },
                {
                    startLine: 2,
                    endLine: 2,
                    search: 'function three() { return 3; }',
                    replace: 'const three = () => 3;'
                }
            ]
        });
        
        // Check that valid changes were applied
        const content = await vscode.workspace.fs.readFile(errorTestUri);
        const text = Buffer.from(content).toString('utf8');
        
        assert.ok(text.includes('const one = () => 1;'), 'First valid change applied');
        assert.ok(text.includes('function two() { return 2; }'), 'Unchanged line preserved');
        assert.ok(text.includes('const three = () => 3;'), 'Third valid change applied');
        assert.ok(!text.includes('invalid'), 'Invalid change not applied');
    });
});