# Change Log

All notable changes to the "vscode-mcp-server" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

### Added
- **Shell Timeout Reset Feature**: Implemented intelligent timeout management for shell commands
  - Timeouts now reset when new commands are executed in the same shell
  - Sending input via `send_input_to_shell` resets timeout to 45 seconds
  - Added timeout status display in `list_active_shells` with expiration warnings
  - Prevents premature timeouts during interactive sessions (npm create, git rebase -i, etc.)
- **ShellTimeoutManager**: Centralized timeout management system
  - Tracks timeouts per shell independently
  - Supports timeout cancellation and reset
  - Provides remaining time information
  - Proper cleanup on shell disposal
- **Enhanced ManagedShell Interface**: Added timeout tracking fields
  - `activeTimeout`: NodeJS.Timeout handle
  - `timeoutEndTime`: When the timeout will expire
  - `timeoutDuration`: Total timeout duration
  - `timeoutController`: AbortController for cancellable operations
- **Comprehensive Test Suite**: Added timeout reset tests
  - Unit tests for ShellTimeoutManager
  - Integration tests for realistic scenarios
  - Concurrent operation tests
  - Timing accuracy tests

### Changed
- `executeShellCommand`: Now accepts optional `shellId` parameter for timeout tracking
- `execute_shell_command_code`: Clears existing timeouts before executing new commands
- `send_input_to_shell`: Resets timeout when input is sent to interactive/busy shells

### Technical Details
- Default timeout: 15 seconds
- Interactive timeout: 45 seconds
- Background processes: No timeout
- Maximum concurrent shells: 8
- Auto-cleanup after 5 minutes of inactivity

## [0.0.1] - Initial Release

- Initial release
