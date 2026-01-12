# VS Code MCP Server

A Visual Studio Code extension (available on the [Marketplace](https://marketplace.visualstudio.com/items?itemName=JuehangQin.vscode-mcp-server)) that allows Claude and other MCP clients to code directly in VS Code! Inspired by [Serena](https://github.com/oraios/serena), but using VS Code's built-in capabilities. This is currently far simpler than Serena, but it works! Note that this extension uses the streamable HTTP API, not the SSE API.

This extension can allow for execution of shell commands. This means that there is a potential security risk, so use with caution, and ensure that you trust the MCP client that you are using and that the port is not exposed to anything. Authentication would help, but as the MCP authentication spec is still in flux, this has not been implemented for now.

PRs are welcome!

## Demo Video
<https://github.com/user-attachments/assets/20b87dfb-fc39-4710-a910-b9481dde1e90>

## Installation

1. Install the extension from the [Marketplace](https://marketplace.visualstudio.com/items?itemName=JuehangQin.vscode-mcp-server) or clone this repository and run `npm install` and `npm run compile` to build it.

## Claude Desktop Configuration

Claude Desktop can be configured to use this extension as an MCP server. To do this, your `claude_desktop_config.json` file should look like this:
```
{
  "mcpServers": {
    "vscode-mcp-server": {
        "command": "npx",
        "args": ["mcp-remote@next", "http://localhost:3000/mcp"]
    }

  }
}
```

I also like to use this extension in a Claude project, as it allows me to specify additional instructions for Claude. I find the following prompt to work well:
```
You are working on an existing codebase, which you can access using your tools. These code tools interact with a VS Code workspace.

Before running code tools that will make any modification to code, always present a comprehensive and detailed plan to the user, including your confidence level (out of 10). When planning, use your tools to explore the codebase so that you understand the context of the project. If you are not confident in your plan because you require more information, use your tools, such as web search, to look for this information or ask the user.

IMPORTANT: Only run code tools that will modify code after presenting such a plan to the user, and receiving explicit approval. Approval must be given each time; prior approval for a change does not imply that subsequent changes are approved.
```

This extension serves as a Model Context Protocol (MCP) server, exposing VS Code's filesystem and editing capabilities to MCP clients.

## Features

The VS Code MCP Server extension implements an MCP-compliant server that allows AI models and other MCP clients to:

- **List files and directories** in your VS Code workspace
- **Read file contents** with encoding support and size limits
- **Search for symbols** across your workspace
- **Get symbol definitions** and hover information by line and symbol name
- **Create new files** using VS Code's WorkspaceEdit API
- **Make line replacements** in files
- **Check for diagnostics** (errors and warnings) in your workspace
- **Execute shell commands** in the integrated terminal with shell integration
- **Toggle the server** on and off via a status bar item

This extension enables AI assistants and other tools to interact with your VS Code workspace through the standardized MCP protocol.

## How It Works

The extension creates an MCP server that:

1. Runs locally on a configurable port (when enabled)
2. Handles MCP protocol requests via HTTP
3. Exposes VS Code's functionality as MCP tools
4. Provides a status bar indicator showing server status, which can be clicked to toggle the server on/off

## Supported MCP Tools

### File Tools
- **list_files_code**: Lists files and directories in your workspace
  - Parameters:
    - `path`: The path to list files from
    - `recursive` (optional): Whether to list files recursively

- **read_file_code**: Reads file contents
  - Parameters:
    - `path`: The path to the file to read
    - `encoding` (optional): File encoding (default: utf-8)
    - `maxCharacters` (optional): Maximum character count (default: 200,000)

### Edit Tools
- **create_file_code**: Creates a new file using VS Code's WorkspaceEdit API
  - Parameters:
    - `path`: The path to the file to create
    - `content`: The content to write to the file
    - `overwrite` (optional): Whether to overwrite if the file exists (default: false)
    - `ignoreIfExists` (optional): Whether to ignore if the file exists (default: false)

- **replace_lines_code**: Replaces specific lines in a file
  - Parameters:
    - `path`: The path to the file to modify
    - `startLine`: The start line number (0-based, inclusive)
    - `endLine`: The end line number (0-based, inclusive)
    - `content`: The new content to replace the lines with
    - `originalCode`: The original code for validation

### Diagnostics Tools
- **get_diagnostics_code**: Checks for warnings and errors in your workspace
  - Parameters:
    - `path` (optional): File path to check (if not provided, checks the entire workspace)
    - `severities` (optional): Array of severity levels to include (0=Error, 1=Warning, 2=Information, 3=Hint). Default: [0, 1]
    - `format` (optional): Output format ('text' or 'json'). Default: 'text'
    - `includeSource` (optional): Whether to include the diagnostic source. Default: true

  This tool is particularly useful for:
  - Code quality checks before committing changes
  - Verifying fixes resolved all reported issues
  - Identifying problems in specific files or the entire workspace

### Symbol Tools
- **search_symbols_code**: Searches for symbols across the workspace
  - Parameters:
    - `query`: The search query for symbol names
    - `maxResults` (optional): Maximum number of results to return (default: 10)
  
  This tool is useful for:
  - Finding definitions of symbols (functions, classes, variables, etc.) across the codebase
  - Exploring project structure and organization
  - Locating specific elements by name

- **get_symbol_definition_code**: Gets definition information for a symbol in a file
  - Parameters:
    - `path`: The path to the file containing the symbol
    - `line`: The line number of the symbol (0-based)
    - `symbol`: The symbol name to look for on the specified line
  
  This tool provides:
  - Type information, documentation, and source details for symbols
  - Code context showing the line where the symbol appears
  - Symbol range information
  
  It's particularly useful for:
  - Understanding what a symbol represents without navigating away
  - Checking function signatures, type definitions, or documentation
  - Quick reference for APIs or library functions

### Shell Tools

#### Command Execution
- **execute_shell_command_code**: Executes a shell command in the VS Code integrated terminal with enhanced timeout handling
- Parameters:
  - `command`: The shell command to execute
  - `cwd` (optional): Working directory for the command (default: '.')
  - `shellId` (optional): ID of the shell to use (e.g., "shell-1"). If not provided, uses default shell or creates new one
  - `interactive` (optional): Set to true for commands that might require user input (uses 45s timeout instead of 15s)
  - `background` (optional): Set to true for long-running background processes (returns immediately)
  - `silenceOutput` (optional): Set to true to suppress output display and save full output to file
  
  Key features:
- **Automatic timeout reset**: Timeouts reset when new commands are executed in the same shell
- **Default timeout**: 15 seconds for regular commands
- **Interactive timeout**: 45 seconds for interactive commands
- **Background mode**: No timeout for background processes
- **Output limiting**: Truncates output over 100k characters and saves to file
- **Safety warnings**: Detects potentially destructive commands
  
  This tool is useful for:
- Running CLI commands and build operations
- Executing git commands
- Interactive command sessions (npm create, git rebase -i, etc.)
- Long-running processes (npm run dev, watch modes)
- Getting command output for analysis

#### Shell Management
- **list_active_shells**: Lists all currently active shell sessions with timeout information
  - No parameters required
  
  Displays:
  - Shell ID and name
  - Current status (idle, busy, waiting-for-input, crashed)
  - Current directory
  - Running command (if any)
  - Creation time and last used time
  - **Timeout status**: Shows remaining time and warnings for expiring timeouts
  
  Useful for:
  - Managing multiple concurrent shells
  - Monitoring shell status and timeouts
  - Identifying shells that need attention

- **send_input_to_shell**: Sends input to a specific shell that may be waiting for user input
  - Parameters:
    - `shellId`: ID of the shell to send input to (e.g., "shell-1")
    - `input`: The input text to send to the shell
    - `includeNewline` (optional): Whether to include a newline character (default: true)
  
  Key features:
  - **Automatic timeout reset**: Resets timeout to 45 seconds when input is sent
  - Useful for interactive prompts, password entries, confirmations
  - Works with shells in 'waiting-for-input' or 'busy' status
  
  This tool is essential for:
  - Responding to interactive prompts (y/n, continue?, etc.)
  - Providing passwords or authentication
  - Continuing paused processes
  - Multi-step interactive workflows

#### Workspace Context
- **get_workspace_context**: Provides context about the current VS Code workspace
  - No parameters required
  
  Returns:
  - Current working directory
  - VS Code workspace folders
  - Basic project information (from package.json if available)
  - Active shells summary
  
  Useful for:
  - Understanding the project structure
  - Getting workspace paths
  - Quick project overview

### Shell Timeout Behavior

The shell tools implement an intelligent timeout system to prevent hanging commands while supporting interactive workflows:

1. **Timeout Durations**:
   - Regular commands: 15 seconds
   - Interactive commands: 45 seconds  
   - Background processes: No timeout

2. **Timeout Reset**:
   - Executing a new command in a shell clears any existing timeout
   - Sending input via `send_input_to_shell` resets the timeout to 45 seconds
   - This ensures long interactive sessions don't timeout prematurely

3. **Timeout Visibility**:
   - Use `list_active_shells` to see remaining timeout for each shell
   - Shells with < 5 seconds remaining show a ⚠️ warning
   - Helps identify shells that need attention

4. **Shell Lifecycle**:
   - Maximum 8 concurrent shells
   - Shells auto-cleanup after 5 minutes of inactivity
   - Crashed shells can be reused with the same ID

## Caveats/TODO

Currently, only one workspace is supported. The extension also only works locally, to avoid exposing your VS Code instance to any network you may be connected to.

## Extension Settings

This extension contributes the following settings:

- `vscode-mcp-server.port`: The port number for the MCP server (default: 3000)

## Using with MCP Clients

To connect MCP clients to this server, configure them to use:
```
http://localhost:3000/mcp
```

Remember that you need to enable the server first by clicking on the status bar item!

## Contributing

Contributions are welcome! Feel free to submit issues or pull requests.

## License

[MIT](LICENSE)
