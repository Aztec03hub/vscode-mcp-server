# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
All entries added to this file must use a standardized schema and be added to their appropriate section, ALWAYS after the standardized schemas. Standardized schemas should always appear at the top of the file immediately after this instruction.

---

# STANDARDIZED SCHEMAS

## Critical Rule Schema

````yaml
## 🚨 CRITICAL RULE - [RULE_NAME] ([DATE])

**MANDATORY REQUIREMENT**: Brief statement of the rule

**Context**: Why this rule exists

**Correct Pattern**:
```code
// Example of correct implementation
```

**What Breaks Without This:**
- Specific failure modes
- Error messages you'll see

**Verification:** How to check it's working

---

````

---

## Tool Usage Pattern Schema

````yaml
## 🔧 TOOL USAGE PATTERN - [TOOL_NAME] - [PATTERN_NAME] ([DATE])

**Mandatory Pattern**:
```code
// Exact syntax that must be used
```

**Key Requirements**:
- Specific requirements for success
- Common failure modes to avoid

**Why This Pattern**:
- Technical reasoning
- What breaks without it

**Example Usage**:
```code
// Working example
```

**Common Mistakes**:
- ❌ Wrong pattern
- ✅ Correct pattern

---

````

---

## Memory Entry Schema

```yaml
## 🧠 MEMORY ENTRY - [CATEGORY] - [MEMORY_ENTRY_NAME] - [PRIORITY (CRITICAL/HIGH/MEDIUM/LOW)] ([DATE])

**Context**: Brief description of the situation/problem (concise summary)
**Issue/Challenge**: Specific problem encountered (concise summary)
**Solution**: What was implemented/decided (concise summary)
**Details**:
- Specific implementation details
- Code patterns used
- Commands/tools involved

---

```

---

## Testing Information Schema

```yaml
## 🧪 TESTING INFORMATION - [TEST_TYPE] - [COMPONENT/FEATURE] ([DATE])

**Test Status**: ✅ PASSING ([X]/[Y]) / 🔄 PARTIAL / ❌ FAILING / [ ] NOT_IMPLEMENTED

**Coverage**: [XX]% (if applicable)

**Key Test Cases**:
- Test case 1: Description (status)
- Test case 2: Description (status)

**Implementation Details**:
- Framework/tools used
- Specific patterns established

**Lessons Learned**:
- What worked well
- What to avoid next time

**Files**: Test file locations

**Priority Levels**: 🚨 CRITICAL, ⚡ HIGH, 📋 MEDIUM, 🎨 LOW

**Categories**: TOOL_USAGE, TESTING, CONFIG, DEBUGGING, API, DATABASE, WORKFLOW, etc.

---

```

---

## Task Plan Schema

```yaml
## 📋 Task Plan: [TITLE]

**Goal**: Clear objective description

**Priority**: 🔥 CRITICAL / ⚡ HIGH / 📋 MEDIUM / 🎨 LOW

**Status**: ✅ [x] COMPLETE / 🔄 [~] IN_PROGRESS / [ ] NOT_STARTED

**Implementation Phases**:
#### Phase 1: [Name] [Status]
- [ ] Step 1.1: Description
- [x] Step 1.2: Completed item

**Success Criteria**:
- [ ] Measurable outcome 1
- [ ] Measurable outcome 2

**Files Created/Modified**: List when complete

---

```

---

# CRITICAL RULES SECTION

## 🚨 CRITICAL RULE - Workspace Tool Usage Requirements (2025-06-24)

**MANDATORY REQUIREMENT**: Always start with get_workspace_context, read CLAUDE.md in full, then follow TDD patterns

**Context**: Ensures proper workspace understanding and follows established development patterns

**Correct Pattern**:

```bash
# Required startup sequence:
1. get_workspace_context() - understand current workspace
2. read_file_code(CLAUDE.md) in 2000 line chunks - get latest context
3. Use TDD (Test-Driven Development): write tests first, implement basic functionality, add complexity
4. Always check diagnostics after apply_diff
5. Run linter/prettier after fixing syntax errors
6. Always ask for permission first before updating/adding an entry to CLAUDE.md. All entries added to CLAUDE.md must use a standardized schema and be added to their appropriate section, ALWAYS after the standardized schemas.
```

**What Breaks Without This**:

- Missing critical workspace context
- Duplicate work or conflicting patterns
- Poor code quality without TDD
- Syntax errors going undetected

**Verification**: Workspace context obtained, CLAUDE.md read completely, tests written before implementation

---

## 🚨 CRITICAL RULE - Use Logger Instead of Console Methods (2025-09-23)

**MANDATORY REQUIREMENT**: NEVER use console.log, console.error, console.warn - ALWAYS use the universal logger

**Context**: The project has a universal logger system that provides structured logging, proper formatting, file persistence, and centralized log management. Direct console methods bypass all logging infrastructure.

**Correct Pattern**:

```typescript
// Server-side logging
import { logger } from '$lib/logger';

logger.info('User logged in', { userId: user.id });
logger.warn('API rate limit approaching', { remaining: 10 });
logger.error('Database connection failed', { error });

// Client-side logging
import { getLogger } from '$lib/logger';
const logger = getLogger();

logger.info('Page loaded');
logger.debug('Component rendered', { props });
```

**What Breaks Without This:**

- Logs won't be persisted to files
- No structured logging format for parsing
- Missing timestamps and metadata
- No log level filtering
- Logs won't appear in VS Code pattern format
- No sanitization of sensitive data
- No batching for client-side logs
- eslint errors for using restricted globals

**Verification**: Run `grep -r "console\." src/` - should only find console usage in:

- Logger implementation files themselves
- Test files that explicitly test console output
- Third-party code

---

## 🚨 CRITICAL RULE - Essential Architecture Documentation Reading (2025-09-18)

**MANDATORY REQUIREMENT**: After reading CLAUDE.md, must read essential architecture documentation files for project context

**Context**: These core architecture files provide critical project context needed before beginning any work

**Correct Pattern**:

```bash
# After reading CLAUDE.md, read these files in order using read_file_code in 5000 line chunks:
1. docs/dev/architecture/README.md
2. docs/dev/architecture/00_Table-of-Contents.md
3. docs/dev/architecture/01_Executive-Summary.md
4. docs/dev/architecture/02_Complete-Technology-Stack.md
5. docs/dev/architecture/03_Architecture-Overview.md
6. docs/dev/architecture/05_Development-Environment.md
7. docs/dev/architecture/06_Application-Architecture.md
8. docs/dev/architecture/22_Development-Workflow.md
9. docs/dev/architecture/23_Code-Organization.md
10. docs/dev/architecture/26_Environment-Configuration.md

# Additional files may be needed based on specific tasks - use best judgment
```

**What Breaks Without This**:

- Missing critical project context and architecture understanding
- Making changes that conflict with established patterns
- Implementing solutions that don't align with project structure
- Duplicating existing functionality or patterns
- Working with outdated assumptions about the codebase

**Verification**: All essential architecture files read before starting any implementation work

---

## 🚨 CRITICAL RULE - CLAUDE.md Schema Usage (2025-06-18)

**MANDATORY REQUIREMENT**: All new content added to CLAUDE.md must use the standardized schemas and be placed in an appropriate section.
**Context**: Maintains organization and prevents file from becoming bloated again
**Correct Pattern**:

```yaml
# Choose appropriate schema from top of file:
# Memory Entry, Tool Usage Pattern, Task Plan, Critical Rule, or Testing Information
# Follow exact format including priority levels and categories
# Use concise summaries, avoid verbose explanations
# Remove or consolidate duplicate information
# Add to appropriate section, for example `# CRITICAL RULES SECTION`, `# TOOL USAGE PATTERN SECTION`, `# MEMORY ENTRY SECTION`, `# TESTING INFORMATION SECTION`, or `# TASK PLAN SECTION`.
```

**What Breaks Without This:**

- File becomes disorganized and hard to navigate
- Information becomes redundant and bloated
- Future Claude instances waste time parsing verbose content
- Token costs increase unnecessarily

**Verification**: New entries follow schema format exactly and are appropriately categorized

---

## 🚨 CRITICAL RULE - Source Code Modification Workflow (2025-10-01)

**MANDATORY REQUIREMENT**: All source code modifications must follow complete quality assurance workflow including task plan updates

**Context**: Ensures quality, consistency, reliability, and accurate progress tracking for all code changes

**Correct Pattern**:

```bash
# After apply_diff
npm run lint                    # Check linting issues
npx prettier --write .          # Format code consistently
# Then use get_diagnostics_code tool
# Fix any issues found
# For tests, run: npm test (or specific test command)
# Fix any test failures

# THEN update task plan checkboxes
# Task plans can be located in:
#   - CLAUDE.md (in TASK PLAN SECTION)
  #   - docs/dev/MVP-Implementation-Task-Plan.md
  #   - Other dedicated task plan documents
    apply_diff({
  description: 'Mark completed task in task plan',
  diffs: [{
    search: '- [ ] Task description',
    replace: '- [x] Task description',
    startLine: X,
    endLine: Y
  }],
  filePath: 'CLAUDE.md'  # or 'docs/dev/MVP-Implementation-Task-Plan.md'
})

# THEN continue to next step/task
```

**What Breaks Without This:**

- Syntax errors and type issues go undetected
- Inconsistent code formatting across project
- Broken tests that appear to work
- Professional standards violations
- Task progress not tracked accurately
- Confusion about what's actually complete
- Difficulty recovering context after interruptions

**Verification**: All tools pass (lint, prettier, diagnostics, tests) AND task plan checkboxes updated before continuing to next step/task

---

## 🚨 CRITICAL RULE - apply_diff File Modification Pattern (2025-06-24)

**MANDATORY REQUIREMENT**: Never rewrite entire files when using apply_diff; always use precise, batch calls after re-reading file content

**Context**: Avoids file corruption and maintains precision in code modifications

**Correct Pattern**:

```bash
# 1. Re-read entire file in 2000 line chunks when issues exist
read_file_code({ path: 'file.ts', maxCharacters: 200000, startLine: -1, endLine: 2000 })
read_file_code({ path: 'file.ts', maxCharacters: 200000, startLine: 2000, endLine: 3000 })
# Continue until entire file is read

# 2. Use precise, batch apply_diff calls to fix issues
apply_diff({
  description: 'Fix specific issues',
  diffs: [
    { search: 'exact text 1', replace: 'fixed text 1', startLine: X, endLine: Y },
    { search: 'exact text 2', replace: 'fixed text 2', startLine: A, endLine: B }
  ],
  filePath: 'file.ts'
})
```

**What Breaks Without This:**

- File corruption from incomplete rewrites
- Loss of existing functionality
- Major formatting issues requiring complete file reconstruction
- Context loss from not understanding complete file state

**Verification**: File maintains all existing functionality, no syntax errors, proper formatting

---

## 🚨 CRITICAL RULE - Step-by-Step Approval Workflow (2025-06-24)

**MANDATORY REQUIREMENT**: Get explicit approval for each step; prior approval does not imply subsequent approval

**Context**: Ensures user maintains control over implementation process and can provide feedback

**Correct Pattern**:

```bash
# For each step:
1. Present comprehensive task plan with confidence level (out of 10)
2. Wait for explicit approval
3. Implement only the approved step
4. Verify step works properly
5. Update task plan status
6. Wait for approval before next step
```

**What Breaks Without This**:

- Implementing unwanted changes
- Missing critical user feedback
- Proceeding with incorrect assumptions
- User loses control over development process

**Verification**: Each step gets explicit user approval before any code modification tools are used

---

## 🚨 CRITICAL RULE - CLAUDE.md Update Permission Request (2025-09-18)

**MANDATORY REQUIREMENT**: After completing work and providing summary, ALWAYS ask user for permission to update CLAUDE.md

**Context**: Ensures user maintains control over CLAUDE.md updates and can review entries before they're added

**Correct Pattern**:

```bash
# After completing work:
1. Complete all requested tasks
2. Provide comprehensive summary of changes
3. Ask: "Would you like me to update CLAUDE.md with an entry documenting this work?"
4. Wait for explicit approval
5. If approved, add appropriate entry using standardized schema
6. Place entry in correct section
```

**What Breaks Without This**:

- CLAUDE.md gets updated without user consent
- User loses control over documentation
- Entries may be added that user doesn't want
- Documentation becomes cluttered with unnecessary entries

**Verification**: User explicitly approves CLAUDE.md update before any changes are made

---

## 🚨 CRITICAL RULE - MVP Task Plan Checkbox Updates (2025-09-18)

**MANDATORY REQUIREMENT**: When tasks are completed in docs/dev/MVP-Implementation-Task-Plan.md, update corresponding checkboxes ONLY after verifying actual implementation

**Context**: Ensures accurate progress tracking and prevents false completion claims

**Correct Pattern**:

```bash
# For each completed task:
1. Verify the feature/task is actually implemented:
   - Code exists and works as expected
   - Tests pass (if applicable)
   - Feature can be demonstrated
   - Related documentation updated
2. Update checkbox from [ ] to [x] using apply_diff:
   apply_diff({
     description: 'Mark [specific task] as complete',
     diffs: [{
       search: '- [ ] Specific task description',
       replace: '- [x] Specific task description',
       startLine: X,
       endLine: Y
     }],
     filePath: 'docs/dev/MVP-Implementation-Task-Plan.md'
   })
3. Never mark parent sections complete until ALL child tasks are verified complete
```

**What Breaks Without This**:

- False sense of progress leading to missed requirements
- Confusion about what's actually implemented
- Planning based on incorrect completion status
- Loss of trust in progress tracking

**Verification**:

- Can demonstrate the feature working
- Code review confirms implementation matches requirements
- No hallucinated or assumed completions

---

## 🚨 CRITICAL RULE - Sequential Phase Completion in MVP Task Plan (2025-09-19)

**MANDATORY REQUIREMENT**: Complete ALL tasks in current sub-sub-step before moving to next sub-sub-step

**Context**: The MVP Task Plan uses hierarchical numbering (1.1.1, 1.1.2, etc.) to ensure proper dependency ordering and systematic implementation

**Correct Pattern**:

```bash
# Phase structure example:
# 1.1.1 Initialize SvelteKit Project (6 tasks)
# 1.1.2 Create Complete Directory Structure (1 task with sub-items)
# 1.1.3 Install ALL Required Dependencies (2 main tasks)

# CORRECT approach:
1. Start with 1.1.1 - complete ALL 6 tasks
2. Verify each task actually works (not just marking checkboxes)
3. Mark all 6 tasks as [x] complete
4. ONLY THEN move to 1.1.2

# WRONG approach:
- Jumping between 1.1.1 and 1.1.2 tasks
- Moving to 1.1.2 with incomplete tasks in 1.1.1
- Marking tasks complete without verification
```

**What Breaks Without This**:

- Dependencies not properly set up for later phases
- Hidden failures that compound in later steps
- Incomplete foundation causing mysterious errors
- Time wasted debugging issues from skipped steps
- Loss of systematic progress tracking

**Verification**: Before moving to next sub-sub-step, confirm ALL checkboxes in current step are [x] and functionality is demonstrable

---

## 🚨 CRITICAL RULE - UI Component Installation via shadcn-svelte CLI (2025-09-19)

**MANDATORY REQUIREMENT**: Always use shadcn-svelte CLI to add UI components, never create them manually

**Context**: shadcn-svelte provides a consistent, well-tested component library that integrates properly with our TailwindCSS configuration

**Correct Pattern**:

```bash
# To add a new UI component:
npx shadcn-svelte@latest add [component-name]

# Examples:
npx shadcn-svelte@latest add button
npx shadcn-svelte@latest add dialog
npx shadcn-svelte@latest add form

# Components are installed to: src/lib/components/ui/[component-name]/
```

**What Breaks Without This**:

- Inconsistent component implementations
- Missing dependencies (like tailwind-variants)
- Improper TypeScript types
- Style conflicts with TailwindCSS theme
- Loss of accessibility features

**Verification**: Check that components exist in src/lib/components/ui/ and follow shadcn-svelte patterns

---

## 🚨 CRITICAL RULE - Git Branch-Per-Step Workflow (2025-01-13)

**MANDATORY REQUIREMENT**: Use branch-per-step workflow for ALL implementation work

**Context**: Provides work isolation, progress tracking, and interruption recovery using only Git

**Correct Pattern**:

```bash
# 1. Start work on a step, testing requirements, or deliverables
# For steps:
git checkout -b phase-X.Y.Z-<kebab-case-description>
git commit --allow-empty -m "step(X.Y.Z): start - <Step Description>"

# For phase testing requirements:
git checkout -b phase-X-testing-requirements
git commit --allow-empty -m "step(X-testing): start - Phase X Testing Requirements"

# For phase deliverables:
git checkout -b phase-X-deliverables
git commit --allow-empty -m "step(X-deliverables): start - Phase X Deliverables"

# 2. Work on tasks with consistent commit messages
git add -A
git commit -m "task(X.Y.Z.N): complete - <Task Description>"
# Or for testing/deliverables:
git commit -m "task(X-testing.N): complete - <Test Description>"
git commit -m "task(X-deliverables.N): complete - <Deliverable Description>"

# 3. ALWAYS update task checkbox immediately after task completion
apply_diff({
  description: 'Mark task complete',
  diffs: [{
    search: '- [ ] <Task description>',
    replace: '- [x] <Task description>',
    startLine: <line>,
    endLine: <line>
  }],
  filePath: 'docs/dev/MVP-Implementation-Task-Plan.md'
})

# 4. Complete the work when all tasks done
git checkout main
git merge --no-ff <branch-name> -m "merge: complete <description>"
```

**Progress Checking Commands**:

```bash
# Check current step from branch name
git branch --show-current
# Example output: phase-1.4.3-base-layout-structure

# See completed tasks in current step
git log --oneline --grep="task(" main..HEAD
# Example output:
# abc1234 task(1.4.3.2): complete - Set up global styles and fonts
# def5678 task(1.4.3.1): complete - Create root +layout.svelte

# See all files changed in current step
git diff --name-only main...HEAD
# Example output:
# src/routes/+layout.svelte
# src/app.css

# Check task plan to see which tasks remain
# Read the section for current step to see checkboxes
```

**Recovery After Network Interruption**:

```bash
# 1. FIRST: Always get workspace context
get_workspace_context()

# 2. Check which branch you're on
execute_shell_command_code({ command: "git branch --show-current" })

# If on a phase branch (e.g., phase-1.4.3-base-layout-structure):
# 3. Extract step ID from branch name (1.4.3 in this example)

# 4. Check last few commits to understand what was completed
execute_shell_command_code({ command: "git log --oneline -5" })

# 5. Check for uncommitted changes
execute_shell_command_code({ command: "git status --short" })

# 6. Read the MVP Task Plan section for the current step
read_file_code({
  path: "docs/dev/MVP-Implementation-Task-Plan.md",
  startLine: [line number for step section],
  endLine: [line number for step section + 30]
})

# 7. Compare completed commits with task checkboxes to find next task

# 8. If there are uncommitted changes:
#    - Review them with git diff
#    - Determine if they belong to the interrupted task
#    - Either commit them or discard if incomplete

# 9. Continue with next uncompleted task
```

**Example Recovery Scenario**:

```bash
# After interruption, you find:
# - Branch: phase-1.4.3-base-layout-structure
# - Last commit: task(1.4.3.4): complete - Create +error.svelte
# - Task plan shows: Task 5 "Set up basic loading states" is unchecked
# - No uncommitted changes

# Therefore: Continue with task 1.4.3.5
```

**What Breaks Without This**:

- Work mixed together on main branch causing conflicts
- No clear recovery point after interruptions
- Loss of context about which step/task was in progress
- Difficult to review or revert specific steps
- Can't track which files belong to which task

**Verification**:

- Current branch matches one of these patterns:
  - `phase-X.Y.Z-*` for step work
  - `phase-X-testing-requirements` for testing requirements
  - `phase-X-deliverables` for deliverables
- Each task has a commit with format:
  - `task(X.Y.Z.N): <status> - <description>` for steps
  - `task(X-testing.N): <status> - <description>` for testing
  - `task(X-deliverables.N): <status> - <description>` for deliverables
- Task checkboxes in MVP Task Plan match completed commits
- No work done directly on main branch

---

## 🚨 CRITICAL RULE - Testing Requirements and Deliverables are Separate Sections (2025-09-22)

**MANDATORY REQUIREMENT**: Testing Requirements and Deliverables are SEPARATE sections that must be completed for EVERY phase

**Context**: Each phase in the MVP Task Plan has three distinct components that require separate branches and completion

**Correct Pattern**:

```bash
# For each phase:
1. Complete all implementation steps (X.Y.Z)
2. Complete Testing Requirements section:
   git checkout -b phase-X-testing-requirements
   git commit --allow-empty -m "step(X-testing): start - Phase X Testing Requirements"
   # Implement all tests
   git commit -m "task(X-testing.N): complete - <Test Description>"

3. Complete Deliverables section:
   git checkout -b phase-X-deliverables
   git commit --allow-empty -m "step(X-deliverables): start - Phase X Deliverables"
   # Create/verify all deliverables
   git commit -m "task(X-deliverables.N): complete - <Deliverable Description>"
```

**What Breaks Without This**:

- Incomplete phase implementation
- Missing tests that catch regressions
- Lack of documentation for completed work
- Confusion about what constitutes a "complete" phase
- MVP Task Plan checkboxes not properly tracked

**Verification**: Before marking any phase complete, verify:

- All implementation steps are merged
- Testing Requirements branch is merged
- Deliverables branch is merged
- All checkboxes in all three sections are marked complete

---

## � CRITICAL RULE - Phase Cleanup Step Requirement (2025-09-22)

**MANDATORY REQUIREMENT**: Every phase must include a final cleanup step to fix all diagnostics, dependencies, and code quality issues

**Context**: Ensures consistent code quality and prevents accumulation of technical debt across phases

**Correct Pattern**:

```bash
# After completing all implementation, testing, and deliverables for a phase:
1. Create cleanup branch:
   git checkout -b phase-X-cleanup
   git commit --allow-empty -m "step(X-cleanup): start - Fix all errors and warnings"

2. Fix all issues in order:
   - Run get_diagnostics_code and fix all errors/warnings
   - Fix dependency peer dependency issues
   - Run pnpm lint and fix all ESLint issues
   - Run prettier to fix formatting
   - Run cSpell and fix spelling issues
   - Run all tests to ensure nothing broke

3. Commit and merge:
   git add -A
   git commit -m "task(X-cleanup): complete - Fix diagnostics, dependencies, and spelling issues"
   git checkout main
   git merge --no-ff phase-X-cleanup -m "merge: complete Phase X Cleanup"
```

**What Breaks Without This**:

- Errors and warnings accumulate making later debugging harder
- Dependency conflicts compound across phases
- Code quality degrades over time
- CI/CD pipelines fail due to linting errors
- Spelling mistakes remain in documentation

**Verification**: Zero errors in diagnostics, all linting passes, all tests pass, no peer dependency warnings

---

## 😨 CRITICAL RULE - get_diagnostics_code Tool Usage for Workspace-Wide Checks (2025-09-23)

**MANDATORY REQUIREMENT**: When checking for errors/warnings across multiple files, ALWAYS use get_diagnostics_code with NO arguments to check the entire workspace

**Context**: get_diagnostics_code tool doesn't work on directories - only on specific files or the entire workspace

**Correct Pattern**:

```bash
# CORRECT - Check entire workspace for all errors/warnings
get_diagnostics_code()  # No arguments = entire workspace

# CORRECT - Check specific single file
get_diagnostics_code({ path: "src/routes/+page.svelte" })

# WRONG - This silently fails, showing no errors when errors exist!
get_diagnostics_code({ path: "src/routes" })  # Directory paths don't work!
```

**What Breaks Without This**:

- Missing critical errors in other files you modified
- False confidence that code is error-free
- Pushing broken code because you only checked one file
- Silent failures when passing directory paths

**Verification**: Always use no arguments for multi-file work, or check each file individually

---

## 🚨 CRITICAL RULE - Always Follow All Patterns and Workflows (2025-09-30)

**MANDATORY REQUIREMENT**: ALWAYS follow ALL workflows in the correct order: Progress Checking → Git Branch-Per-Step → TDD Workflow → Source Code Modification

**Context**: Ensures consistency, proper context understanding, quality code, and recovery from interruptions

**Correct Pattern**:

```bash
# STEP 1: PROGRESS CHECKING (from Git Branch-Per-Step Workflow)
1. execute_shell_command_code({ command: "git branch --show-current" })
2. execute_shell_command_code({ command: "git log --oneline -5" })
3. execute_shell_command_code({ command: "git status --short" })
4. read_file_code({ path: "docs/dev/MVP-Implementation-Task-Plan.md", startLine: X, endLine: Y })

# STEP 2: ARCHITECTURE READING (from Essential Architecture Documentation)
- Read CLAUDE.md fully in 2000 line chunks
- Read essential architecture docs in specified order
- Understand project context before any work

# STEP 3: GIT BRANCH CREATION (from Git Branch-Per-Step Workflow)
- For tests: git checkout -b phase-X.Y.Z-tests
- For implementation: git checkout -b phase-X.Y.Z-description
- Empty commit with proper message format

# STEP 4: TDD WORKFLOW (from Test-Driven Development Workflow)
- Write tests FIRST (Red)
- Implement MINIMAL code to pass tests (Green)
- Refactor while keeping tests green (Refactor)
- See detailed TDD Workflow critical rule for complete process

# STEP 5: SOURCE CODE QUALITY (from Source Code Modification Workflow)
- After apply_diff: run get_diagnostics_code()
- Fix all errors and warnings
- Run: pnpm lint
- Run: pnpm format
- Verify all quality checks pass

# STEP 6: GIT COMPLETION (from Git Branch-Per-Step Workflow)
- Commit with proper message format
- Merge to main with --no-ff
- Update task plan checkboxes
```

**What Breaks Without This**:

- Lost context after interruptions
- Working on wrong branch or step
- Missing critical architecture understanding
- Code without tests (no safety net)
- Poor code quality
- Unable to recover work state

**Verification**:

- Git commands show correct branch and commits
- Tests exist and pass
- Diagnostics show zero errors
- Task plan shows current step

---

## 😨 CRITICAL RULE - Testing Requirements and Deliverables Are Separate Phase Sections (2025-09-23)

**MANDATORY REQUIREMENT**: Testing Requirements and Deliverables are SEPARATE sections in MVP Task Plan that are part of EVERY phase, not just steps

**Context**: Each phase has three components: implementation steps, testing requirements, and deliverables - all must be completed

**Correct Pattern**:

```bash
# For EVERY phase:
1. Complete all implementation steps (X.Y.Z)
2. Complete Testing Requirements section (separate from steps)
3. Complete Deliverables section (separate from steps)
4. Optional: Cleanup step (undocumented but often necessary)

# Each section requires its own branch:
- phase-X.Y.Z-* for implementation steps
- phase-X-testing-requirements for testing
- phase-X-deliverables for deliverables
- phase-X-cleanup for cleanup (if needed)
```

**What Breaks Without This**:

- Incomplete phases missing critical testing
- Missing deliverables and documentation
- Confusion about phase completion
- Skipping essential quality assurance

**Verification**: All three sections (steps, testing, deliverables) have branches and are marked complete

---

## � CRITICAL RULE - Test-Driven Development (TDD) Workflow (2025-09-30)

**MANDATORY REQUIREMENT**: For EVERY step/sub-step in MVP-Implementation-Task-Plan.md, follow TDD workflow: Tests First → Basic Implementation → Add Complexity

**Context**: Ensures code quality, prevents regressions, provides living documentation, forces consideration of testability during design, and gives confidence in refactoring

**TDD Philosophy - Red, Green, Refactor**:

The TDD cycle is a mantra: **Red → Green → Refactor → Repeat**

- **RED Phase**: Write failing tests first (forces you to think about API design BEFORE coding)
- **GREEN Phase**: Write minimal code to pass tests (simplest implementation, no premature optimization)
- **REFACTOR Phase**: Improve code while keeping tests green (tests provide safety net)

**Complete TDD Workflow Pattern**:

```bash
### PHASE 1: TEST PLANNING & CREATION (RED)

1. Analyze step requirements from MVP-Implementation-Task-Plan.md
2. Create test branch:
   git checkout -b phase-X.Y.Z-tests
   git commit --allow-empty -m "step(X.Y.Z-tests): start - Test implementation for <Step Name>"

3. Write tests in priority order (MVT first):
   Priority 1: Unit tests for utilities, services, pure functions
   Priority 2: Integration tests for API + database operations
   Priority 3: Component tests for Svelte components
   Priority 4: E2E tests for critical user workflows (only critical paths)
   Priority 5: Storybook stories (documentation, not tests)

4. Run tests and verify they FAIL (Red Phase):
   pnpm test:unit          # Should fail with "Cannot find module" or similar
   pnpm test:integration   # Should fail if applicable
   pnpm test:e2e          # Should fail if applicable
   ⚠️  CRITICAL: If tests pass without implementation, they're not testing anything!

5. Commit failing tests:
   git add tests/
   git commit -m "test(X.Y.Z): add failing tests for <feature>"

6. Merge tests to main:
   git checkout main
   git merge --no-ff phase-X.Y.Z-tests -m "merge: tests for step X.Y.Z"

### PHASE 2: BASIC IMPLEMENTATION (GREEN)

7. Create implementation branch:
   git checkout -b phase-X.Y.Z-<kebab-case-description>
   git commit --allow-empty -m "step(X.Y.Z): start - <Step Description>"

8. Implement MINIMAL code to pass ONE test at a time:
   - Pick the simplest test to implement first
   - Write the absolute minimum code to make it pass
   - Don't add features not required by tests
   - Run tests frequently: pnpm test:unit --watch

9. Once ONE test passes (Green):
   git add src/
   git commit -m "feat(X.Y.Z): implement <specific feature> to pass <test name>"

10. Repeat steps 8-9 for each test until ALL tests pass

### PHASE 3: REFACTOR & ENHANCE (REFACTOR)

11. Refactor code while keeping tests green:
    - Improve code structure and naming
    - Extract reusable functions and classes
    - Add proper error handling
    - Add logging using universal logger
    - Optimize performance where needed
    - Add comprehensive TypeScript types
    ⚠️  Tests must stay green during refactoring!

12. Commit each logical refactor:
    git commit -m "refactor(X.Y.Z): improve <aspect> while maintaining test coverage"

13. Add complexity and advanced features:
    - Write new tests for new features FIRST (Red)
    - Implement features (Green)
    - Refactor (Refactor)

### PHASE 4: QUALITY ASSURANCE

14. Final verification:
    - Run diagnostics: get_diagnostics_code() → fix all errors
    - Run linter: pnpm lint → fix all warnings
    - Run prettier: pnpm format → ensure consistent formatting
    - Check coverage: pnpm test:coverage → verify ≥80% for new code
    - Run full test suite: pnpm test

15. Create Storybook stories (if UI components):
    - Document component variants and states
    - Show different use cases
    - Created AFTER tests pass (part of documentation)

### PHASE 5: COMPLETION

16. Complete the step:
    git checkout main
    git merge --no-ff phase-X.Y.Z-<n> -m "merge: complete step X.Y.Z"

17. Update MVP Task Plan checkboxes
```

**Test Type Guidelines by Component**:

| Component Type   | Unit Test  | Integration Test | E2E Test          | Storybook |
| ---------------- | ---------- | ---------------- | ----------------- | --------- |
| Utility Function | ✅ Primary | ❌ No            | ❌ No             | ❌ No     |
| API Endpoint     | ❌ No      | ✅ Primary       | ⭐ Critical Paths | ❌ No     |
| UI Component     | ✅ Primary | ❌ No            | ❌ No             | ✅ Yes    |
| User Workflow    | ❌ No      | ❌ No            | ✅ Primary        | ❌ No     |

**Test Directory Structure** (standardized 2025-09-30):

```
tests/
├── unit/                    # Unit tests (Vitest)
│   ├── lib/
│   │   ├── utils/          # Utility function tests
│   │   ├── server/         # Server-side unit tests
│   │   └── components/     # Svelte component tests
│   └── routes/             # Route handler tests
├── integration/            # Integration tests (Vitest) - API + DB
│   ├── auth/
│   ├── courses/
│   └── database/
├── e2e/                   # E2E tests (Playwright)
│   ├── utils/
│   ├── fixtures/
│   └── *.spec.ts        # E2E test files
├── fixtures/              # Shared test data
├── helpers/               # Test helper utilities
├── seeds/                 # Test database seeds
└── setup.ts               # Global Vitest setup
```

**Naming Conventions**:

- Unit tests: `*.test.ts`
- Integration tests: `*.integration.test.ts`
- E2E tests: `*.spec.ts` (Playwright convention)
- Svelte test wrappers: `*.test.svelte`
- Storybook stories: `*.stories.ts` (in src/, not tests/)

**Minimum Viable Tests (MVT) Approach**:

**Tier 1: MUST-HAVE (Create First - MVT)**

1. ✅ Happy path unit tests for core business logic
2. ✅ Critical API endpoint integration tests (CRUD operations)
3. ✅ ONE E2E test for the primary user workflow
4. ✅ Database integration tests for critical queries

**Tier 2: SHOULD-HAVE (Add After MVT Passing)**

1. ⭐ Edge case unit tests (null, empty, boundary values)
2. ⭐ Error handling integration tests
3. ⭐ Authentication/authorization tests
4. ⭐ Additional E2E tests for secondary workflows

**Tier 3: NICE-TO-HAVE (Add If Time Permits)**

1. 💎 Performance tests
2. 💎 Visual regression tests
3. 💎 Accessibility tests

**Exploratory Prototyping Exception**:

TDD is mandatory for production code, but exploratory prototyping is allowed under strict conditions:

1. **Separate Branch**: Work in `prototype-*` branch only
2. **Clear Commits**: Mark ALL commits with `prototype:` prefix
3. **Time-Boxed**: Set time limit (e.g., 2 hours max)
4. **Delete Prototype**: Once approach validated, DELETE ALL prototype code
5. **Start Fresh with TDD**: Begin new branch with tests first
6. **NEVER Merge**: Prototype code NEVER merged to main - it's throwaway!

**What Breaks Without TDD**:

- ❌ No safety net for refactoring - fear of breaking things
- ❌ Tests written after code follow implementation biases
- ❌ Missing edge cases - only test happy path
- ❌ Poor API design - don't consider testability
- ❌ Regressions go undetected until production
- ❌ Hard to understand code - no living documentation
- ❌ No confidence in deployments

**Benefits of TDD**:

- ✅ Immediate feedback - know instantly if code works
- ✅ Better design - testable code is well-designed code
- ✅ Living documentation - tests show how code should be used
- ✅ Fearless refactoring - tests catch regressions immediately
- ✅ Fewer bugs - catch issues before production
- ✅ Faster debugging - failing test shows exactly what broke
- ✅ Confidence - deploy knowing everything works

**Verification Checklist** (Before Completing Any Step):

- [ ] Tests existed BEFORE implementation (Red)
- [ ] Tests failed initially - proved they test something
- [ ] All tests pass after implementation (Green)
- [ ] Code refactored with passing tests (Refactor)
- [ ] Code coverage meets threshold (≥80% for new code)
- [ ] Zero TypeScript errors (get_diagnostics_code)
- [ ] Zero ESLint warnings (pnpm lint)
- [ ] Prettier formatting applied (pnpm format)
- [ ] Storybook stories created for UI components (if applicable)
- [ ] MVP Task Plan checkboxes updated

**Reference**: See `docs/dev/TDD-Workflow-Enhancement-Plan-FINAL.md` for complete details

---

## 🚨 CRITICAL RULE - Always Verify File Contents Instead of Assuming (2025-09-23)

**MANDATORY REQUIREMENT**: Never assume what you've done - ALWAYS check using read_file_code to read whole files in 2000 line chunks

**Context**: Prevents working with outdated assumptions and ensures you have complete file context

**Correct Pattern**:

```bash
# ALWAYS read files completely before making changes:
read_file_code({ path: 'file.ts', maxCharacters: 200000, startLine: 1, endLine: 2000 })
read_file_code({ path: 'file.ts', maxCharacters: 200000, startLine: 2000, endLine: 3000 })
# Continue until entire file is read

# NEVER assume:
- What code exists in a file
- What changes were made previously
- Current implementation state
- File structure or organization
```

**What Breaks Without This**:

- Making changes based on wrong assumptions
- Duplicating existing code
- Breaking working implementations
- Missing critical context
- Introducing conflicts

**Verification**: File contents match your understanding before any modifications

---

## 😨 CRITICAL RULE - Tool Usage Hierarchy for Documentation and Code (2025-09-23)

**MANDATORY REQUIREMENT**: Use the correct tool hierarchy for finding documentation and code examples

**Context**: Different tools have different strengths - use them in the correct order for best results

**Correct Pattern**:

```bash
# Tool usage hierarchy:
1. PRIMARY: vscode-mcp-server tools
   - read_file_code: Read existing project files
   - apply_diff: Create/modify files

2. DOCUMENTATION SEARCH:
   - brave-search: Find documentation URLs and summaries
   - fetch: Get exact content from URLs found via brave-search
   - context7: Version-specific docs for libraries/frameworks
   - Web Search: Final fallback for general information

# Example workflow for finding docs:
brave_search({ query: "sveltekit 2.0 load function" })
# Get URL from results
fetch({ url: "https://kit.svelte.dev/docs/load" })
# Or use context7 for version-specific:
context7:resolve-library-id({ libraryName: "sveltekit" })
context7:get-library-docs({ context7CompatibleLibraryID: "/sveltejs/kit", topic: "load functions" })
```

**What Breaks Without This**:

- Using wrong tool for the job
- Missing version-specific information
- Getting outdated documentation
- Inefficient information gathering

**Verification**: Documentation matches project's actual versions and requirements

---

## 🧠 MEMORY ENTRY - DATABASE - Consolidated Database Verification Script - HIGH (2025-10-01)

**Context**: Had three separate database test scripts with overlapping functionality and import errors
**Issue/Challenge**: test-better-auth.mjs had TypeScript import errors, check-db-tables.js used Supabase client incorrectly, test-db-integration.mjs worked but was limited
**Solution**: Consolidated all functionality into one comprehensive verify-database.mjs script
**Details**:

- Created `scripts/verify-database.mjs` that performs all verifications:
  - Checks all required tables exist (Better-Auth and custom)
  - Verifies no auth.users foreign key dependencies
  - Validates users table structure and columns
  - Tests full CRUD operations (CREATE, READ, UPDATE, DELETE)
  - Tests session and profile creation
  - Verifies default organization exists
  - Checks search functions are installed
- Uses direct PostgreSQL connection via pg package (no dependencies on Better-Auth imports)
- Provides colored output with clear icons for success/failure
- Returns proper exit codes for CI/CD integration
- Deleted redundant scripts: test-better-auth.mjs, check-db-tables.js, test-db-integration.mjs
- Key command: `node scripts/verify-database.mjs`
- Works with test database on port 54322

---

## 🧠 MEMORY ENTRY - LOGGER - Fixed Debug Logs Not Appearing in Files - CRITICAL (2025-10-08)

**Context**: Debug logs were showing in console but NOT appearing in log files
**Issue/Challenge**: Transport targets in server.ts didn't have `level` property set, causing them to filter out debug logs
**Solution**: Added `level: 'trace'` to all transport targets (pattern-transport.cjs, pino-roll, category logs) so they accept all levels
**Details**:

- Problem: `LOGGER_LEVEL=debug` set in .env.local, console showed debug logs, but files didn't
- Root Cause: Transport targets in `src/lib/logger/transports/server.ts` had no `level` option
- Without `level`, transports use default filtering (typically 'info' or higher)
- Solution: Added `level: 'trace'` to all transport targets:
  - Main app log (pattern-transport.cjs)
  - JSON log (pino-roll)
  - Category-specific logs (security, auth, error)
- Root logger still filters based on config level, transports just accept everything
- Created test endpoint: `/api/test/logger` (POST) to easily verify logger functionality
- Created test script: `scripts/test-logger-endpoint.mjs` to call the endpoint
- Removed temporary console.logs from universal-logger.ts and logout endpoint
- Verification: DEBUG logs now appear in:
  - ✅ Server console (pino-pretty)
  - ✅ logs/YYYY-MM-DD_app.log (pattern format)
  - ✅ logs/YYYY-MM-DD_auth.log (category-specific)
- Key Learning: Pino transport targets need explicit `level: 'trace'` to accept all log levels

---

## 🧠 MEMORY ENTRY - TESTING - Fixed Database Test Warnings and Pino Transport - CRITICAL (2025-10-03)

**Context**: Unit tests were passing but showing warnings about database columns and Pino transport was failing to load
**Issue/Challenge**: Two issues: 1) db-helpers.ts referenced wrong column names for profile_photos and user_preferences tables, 2) pattern-transport.js used CommonJS require() in ES module package
**Solution**: Fixed column references in db-helpers.ts and renamed pattern-transport.js to pattern-transport.cjs for CommonJS compatibility
**Details**:

- profile_photos uses `uploaded_at` not `created_at` column
- user_preferences uses `user_id` as primary key, not `id`
- Updated db-helpers.ts to use correct column names in delete queries
- Renamed pattern-transport.js to pattern-transport.cjs because:
  - File uses CommonJS require() syntax
  - package.json has "type": "module" making all .js files ES modules
  - .cjs extension explicitly marks file as CommonJS
  - Pino transports run in worker threads that expect CommonJS
- Updated all references in server.ts from 'pattern-transport.js' to 'pattern-transport.cjs'
- All unit tests now pass without any warnings or errors

---

## 🧠 MEMORY ENTRY - ENVIRONMENT - SvelteKit Environment Variable Loading Issue - HIGH (2025-10-03)

## 🧠 MEMORY ENTRY - ENVIRONMENT - SvelteKit Environment Variable Loading - CRITICAL (2025-10-03)

**Context**: Server fails with "Invalid environment configuration" error despite .env.local file having all required variables
**Issue/Challenge**: SvelteKit doesn't use process.env or import.meta.env directly - it has its own $env modules for environment variables
**Solution**: Fixed by importing from SvelteKit's $env/static/private and $env/static/public modules
**Details**:

- SvelteKit provides 4 modules for environment variables:
  - `$env/static/private` - Server-only vars loaded at build time
  - `$env/static/public` - Public vars (PUBLIC\_ prefix) loaded at build time
  - `$env/dynamic/private` - Server-only vars loaded at runtime
  - `$env/dynamic/public` - Public vars loaded at runtime
- Updated src/lib/config/env.ts to import from these modules:
  ```typescript
  import * as privateEnv from '$env/static/private';
  import * as publicEnv from '$env/static/public';
  ```
- Combined both public and private env vars for validation
- Added check for `building` flag to skip validation during build
- Environment variables in .env.local are now properly loaded
- Server now starts successfully and API endpoints work
- Key learning: ALWAYS use SvelteKit's $env modules, never process.env or import.meta.env directly

---

## 🧠 MEMORY ENTRY - TESTING - Vitest Test Script Patterns - HIGH (2025-10-13)

**Context**: Vitest uses workspace/projects pattern with three test environments (unit, integration, storybook)
**Issue/Challenge**: Running `npm run test:unit` without `--project` flag executed ALL projects, including Storybook tests
**Solution**: Added `--project` flag to test scripts to isolate test execution by type
**Details**:

**Test Scripts in package.json**:

```json
"test:unit": "vitest --project unit",           // Only unit tests
"test:integration": "vitest --project integration",  // Only integration tests
"test:storybook": "vitest --project storybook",     // Only Storybook tests
"test:all": "vitest",                               // All projects
"test": "npm run test:unit -- --run && npm run test:e2e"  // Unit + E2E
```

**Vitest Projects Configuration** (vitest.config.ts):

- **unit** - Browser-like environment (jsdom) for component/utility tests
- **integration** - Node environment for API/database tests with test DB
- **storybook** - Browser environment (Playwright) for Storybook story tests

**Key Learning**: Always use `--project <name>` flag to run specific test types. Without it, Vitest runs ALL projects in workspace config, which includes Storybook tests that take longer.

**Common Commands**:

- `npm run test:unit` - Fast unit tests only
- `npm run test:integration` - Integration tests with test DB
- `npm run test:storybook` - Storybook visual tests
- `npm run test:all` - All Vitest projects (slower)
- `npm run test:e2e` - Playwright E2E tests

---

# TOOL USAGE PATTERN SECTION

## 🔧 TOOL USAGE PATTERN - apply_diff - File Creation Pattern (2025-09-12)

**Mandatory Pattern**:

```code
// For creating new files, ALWAYS use apply_diff with empty search:
{
  "search": "",
  "endLine": -1,
  "replace": "full file content here",
  "startLine": 1
}
```

**Key Requirements**:

- NEVER use internal file creation tools (create_file, etc.)
- Always use vscode-mcp-server:apply_diff for ALL file operations
- Empty search string indicates new file creation
- endLine: -1 means "to end of file"

**Why This Pattern**:

- User explicitly requires all file operations through vscode MCP tools
- Ensures consistency across all file operations
- Maintains proper workspace integration

**Example Usage**:

```typescript
// Creating a new TypeScript file
{
  "search": "",
  "endLine": -1,
  "replace": "import { json } from '@sveltejs/kit';\n\nexport async function GET() {\n  return json({ status: 'ok' });\n}",
  "startLine": 1
}
```

**Common Mistakes**:

- ❌ Using create_file or other internal tools
- ✅ Always using apply_diff for file creation

---

## 🔧 TOOL USAGE PATTERN - apply_diff - Exact Text Matching Pattern (2025-06-16)

**Mandatory Pattern**:

```typescript
// 1. ALWAYS read file first
read_file_code({ path: 'file.ts', startLine: X, endLine: Y });

// 2. Use exact text matching
apply_diff({
	description: 'Clear description of change',
	diffs: [
		{
			search: 'exact text from file (including tabs/spaces)',
			replace: 'exact replacement text',
			startLine: X,
			endLine: Y
		}
	],
	filePath: 'path/to/file'
});
```

**Key Requirements**:

- Read file content first to get exact text
- Search text must match EXACTLY (whitespace, tabs, indentation)
- Never pass empty diffs array
- Always include startLine/endLine for targeting

**Why This Pattern**:

- Fuzzy matching handles content drift but needs exact base text
- Empty diffs cause "Cannot convert undefined or null to object" error
- Reading first ensures accurate text matching

**Example Usage**:

```typescript
// Read first, then apply exact changes
const fileContent = await read_file_code({ path: 'src/component.ts' });
apply_diff({
	description: 'Update import statement',
	diffs: [
		{
			search: "import { old } from './utils';",
			replace: "import { old, new } from './utils';",
			startLine: 5,
			endLine: 5
		}
	],
	filePath: 'src/component.ts'
});
```

**Common Mistakes**:

- ❌ Empty or undefined diffs array
- ❌ Approximate text matching without reading file
- ❌ Missing whitespace or incorrect indentation
- ✅ Always read file first, use exact text

---

## 🔧 TOOL USAGE PATTERN - search_files - Absolute Path Pattern (2025-06-16)

**Mandatory Pattern**:

```typescript
search_files({
	path: 'C:/Users/plafayette/workspace/node_projects/savvy-next',
	pattern: 'ComponentName'
});
```

**Key Requirements**:

- Always use full absolute paths with forward slashes
- Never use relative paths (./src, src/lib, etc.)
- Must be within allowed directories
- Case-sensitive paths must match filesystem exactly

**Why This Pattern**:

- Tool validates paths against allowed directories for security
- Relative paths cause "Access denied" errors every time
- Essential for navigating large codebases efficiently

**Example Usage**:

```typescript
// ✅ CORRECT - Full absolute path
search_files({
	path: 'C:/Users/plafayette/workspace/node_projects/savvy-next',
	pattern: '*.svelte'
});
```

**Common Mistakes**:

- ❌ `search_files({ path: 'src', pattern: 'Component' })` // Access denied
- ❌ `search_files({ path: './src/lib', pattern: 'utils' })` // Access denied
- ✅ Use workspace root with forward slashes always

---

## 🔧 TOOL USAGE PATTERN - execute_shell_command_code - PowerShell Syntax (2025-09-22)

**Mandatory Pattern**:

```typescript
// Always use PowerShell syntax for commands
execute_shell_command_code({
	command: 'Get-ChildItem -Path . -Filter *.ts', // PowerShell
	description: 'List TypeScript files'
});

// For Git commands, they work the same in PowerShell
execute_shell_command_code({
	command: 'git status',
	description: 'Check git status'
});
```

**Key Requirements**:

- User's environment uses PowerShell, NOT bash
- Use PowerShell cmdlets where appropriate
- Common bash commands like git, npm, pnpm work normally
- File paths can use forward or backward slashes

**Why This Pattern**:

- User's VS Code terminal is configured for PowerShell
- Bash-specific syntax will fail
- Ensures commands work correctly in the environment

**Example Usage**:

```typescript
// ✅ CORRECT - PowerShell
execute_shell_command_code({
	command: 'Test-Path ./src/routes',
	description: 'Check if routes directory exists'
});

// ✅ CORRECT - Git works the same
execute_shell_command_code({
	command: 'git log --oneline -5',
	description: 'Show recent commits'
});

// ❌ WRONG - Bash syntax
execute_shell_command_code({
	command: '[ -d ./src/routes ] && echo exists', // Will fail
	description: 'Check directory'
});
```

**Common Mistakes**:

- ❌ Using bash-specific syntax like `[ ]`, `&&`, `||`
- ❌ Using `ls` instead of `Get-ChildItem` or `dir`
- ❌ Using `rm` instead of `Remove-Item`
- ✅ Git, npm, pnpm, node commands work identically

---

## 🔧 TOOL USAGE PATTERN - fetch - Fetching Web Content Pattern (2025-10-01)

**Mandatory Pattern**:

```typescript
// Basic fetch with URL only
fetch: fetch({
	url: 'https://www.example.com/page'
});

// Fetch with pagination (for truncated content)
fetch: fetch({
	url: 'https://www.example.com/page',
	start_index: 5000 // Continue from where content was truncated
});

// Fetch with options
fetch: fetch({
	url: 'https://www.example.com/page',
	max_length: 10000, // Maximum characters to return (default: 5000)
	raw: false // Get simplified markdown (default), or true for raw HTML
});
```

**Key Requirements**:

- URL must be a complete, valid URL including protocol (https://)
- Tool returns markdown-formatted content by default
- Content may be truncated at max_length - use start_index to continue
- When content shows `<e>Content truncated. Call the fetch tool with a start_index of 5000 to get more content.</e>`, make another call with that start_index

**Why This Pattern**:

- Simplest call: just provide the URL
- No need for complex parameters for basic usage
- Pagination allows fetching large documents in chunks
- Raw HTML available if markdown conversion isn't suitable

**Example Usage**:

```typescript
// Fetch Better-Auth documentation
fetch: fetch({
	url: 'https://www.better-auth.com/docs/concepts/database'
});
// If truncated, continue with:
fetch: fetch({
	url: 'https://www.better-auth.com/docs/concepts/database',
	start_index: 5000
});
```

**Common Mistakes**:

- ❌ Using complex parameters when not needed
- ❌ Forgetting to handle truncated content
- ❌ Not including https:// protocol in URL
- ✅ Start simple with just URL, add options only if needed

---

# MEMORY ENTRY SECTION

## 🧠 MEMORY ENTRY - AUTHENTICATION - Auth Middleware Performance Optimization - HIGH (2025-10-15)

**Context**: Home page integration test was taking ~1250ms due to Better-Auth session checks on every request
**Issue/Challenge**: Better-Auth's svelteKitHandler called on ALL routes including public pages, causing unnecessary database queries
**Solution**: Created route-matcher utility and optimized authHook to skip authentication entirely for public routes
**Details**:

- Created `src/lib/server/auth/route-matcher.ts` with `isPublicRoute()` utility
- Public routes (/, /api/auth/_, /\_app/_, assets) skip both svelteKitHandler AND auth.api.getSession()
- Protected routes fetch session once, populate event.locals, then call svelteKitHandler
- Eliminates redundant session fetching and database queries for public pages
- Integration tests pass with expected HTTP overhead for full stack testing
- Key pattern: Early return with `resolve(event)` for public routes before any auth processing

---

## 🧠 MEMORY ENTRY - AUTHENTICATION - Better-Auth Integration Complete - CRITICAL (2025-10-06)

**Context**: Successfully completed all 11 phases of Better-Auth + Supabase PostgreSQL integration
**Issue/Challenge**: Initial implementation incorrectly tried to use Supabase Auth's auth.users table
**Solution**: Implemented Better-Auth to manage authentication directly through PostgreSQL public schema
**Details**:

- Better-Auth creates its own tables: users, sessions, accounts, verifications (NOT auth.users)
- Uses camelCase column names (firstName, organizationId) not snake_case
- Connects directly to PostgreSQL, bypassing Supabase Auth entirely
- Extended user schema with additionalFields for enterprise requirements
- All authentication routes updated to use Better-Auth API
- Documentation comprehensively updated with zero auth.users references
- Created integration guide at docs/dev/better-auth-supabase-integration.md
- Key Learning: Better-Auth is completely independent of Supabase Auth

---

## 🧠 MEMORY ENTRY - DATABASE - Better-Auth CamelCase Column Names - CRITICAL (2025-10-01)

**Context**: Better-Auth uses camelCase column names in its database schema, not snake_case
**Issue/Challenge**: Migration 03 failed because it referenced columns like first_name instead of firstName
**Solution**: Fixed all column references in migration 03 to use quoted camelCase names like "firstName"
**Details**:

- Better-Auth creates columns: firstName, lastName, displayName, employeeId, organizationId, etc.
- PostgreSQL requires quotes around camelCase column names: `u."firstName"`
- Profile tables use snake_case: phone_primary, personal_email (from our migration 02)
- Must be careful to match exact column naming convention for each table
- Applied migrations manually using docker exec after fixing column names
- Key Learning: Always check the actual column names created by Better-Auth, don't assume snake_case

---

## 🧠 MEMORY ENTRY - AUTHENTICATION - Better-Auth Session Management Architecture - CRITICAL (2025-09-23)

**Context**: Clarified the correct session management architecture after confusion between Better-Auth, Supabase, and Redis integration
**Issue/Challenge**: Inconsistent implementation with some files using direct Supabase client for sessions while Better-Auth should handle all authentication
**Solution**: Better-Auth manages all authentication and sessions, using PostgreSQL for storage and Redis for caching
**Details**:

- Better-Auth uses `getPool()` from `src/lib/server/db/pool.ts` for direct PostgreSQL connection (NOT Supabase client)
- Sessions stored in PostgreSQL `sessions` table (created by our migrations)
- Redis used only for session caching, not primary storage
- ALL authentication flows (including ADP) must go through Better-Auth
- Session validation must use Better-Auth's API methods
- Files needing refactor: `adp-provider.ts` and `middleware.ts` to delegate to Better-Auth
- SessionManager in `session.ts` provides unified interface for session operations
- Key principle: Better-Auth is the single source of truth for all authentication operations

---

## 🧠 MEMORY ENTRY - LOGGING - Server-Side Logging Strategy Implementation - CRITICAL (2025-09-23)

**Context**: ESLint rule restricts console methods to only warn/error, but our architecture requires comprehensive logging
**Issue/Challenge**: `Unexpected console statement. Only these console methods are allowed: warn, error` keeps appearing
**Solution**: Implement proper logger service based on architecture docs and update ESLint configuration
**Details**:

- Architecture specifies comprehensive logging with levels: TRACE, DEBUG, INFO, WARN, ERROR, FATAL
- Create `src/lib/server/services/logger.service.ts` implementing the Logger class from docs
- Update ESLint config to remove console restrictions for server-side code
- Replace all `console.log()` with proper logger methods:
  - `logger.info()` for general information
  - `logger.debug()` for development/debugging
  - `logger.error()` for errors
  - `logger.warn()` for warnings
- Logger provides category-specific methods: `logger.auth()`, `logger.database()`, `logger.api()`
- Structured logging with proper context (userId, sessionId, requestId)
- In development: colorized console output
- In production: database and remote logging
- Key principle: Never use raw console.\* methods, always use the logger service
- Key principle: Better-Auth is the single source of truth for all authentication operations

## 🧠 MEMORY ENTRY - DATABASE - Supabase Migrations and Text Search Implementation - HIGH (2025-09-23)

**Context**: Set up database migrations for authentication/profile tables and implemented full-text search
**Issue/Challenge**: Initial migrations had PostgreSQL errors - text search GIN indexes using to_tsvector weren't IMMUTABLE, and CTE syntax error in function
**Solution**: Fixed migrations by removing problematic indexes, correcting function syntax, then added text search via separate migration using triggers
**Details**:

- Fixed error "functions in index expression must be marked IMMUTABLE" by removing GIN indexes with to_tsvector
- Fixed "syntax error at or near WITH" by wrapping CTE in BEGIN...RETURN QUERY...END block
- Created separate migration (20250923000000_add_text_search.sql) using trigger-based approach:
  - Added search_vector columns maintained by triggers (avoids IMMUTABLE issue)
  - Implemented weighted search (A=names, B=IDs/email, C=contact info, D=bio)
  - Created search functions: search_users(), search_profiles(), search_users_autocomplete()
- Migration order: 1) Auth tables, 2) Insert default org, 3) Profile tables, 4) Text search
- Key learning: PostgreSQL text search indexes require special handling - use triggers instead of computed indexes

## 🧠 MEMORY ENTRY - DOCUMENTATION - Update CI/CD Docs Post-Drizzle Removal - HIGH (2025-09-18)

**Context**: After removing Drizzle and switching to Supabase tooling, CI/CD documentation had outdated references
**Issue/Challenge**: Architecture docs referenced old `db:push` command that no longer existed in package.json
**Solution**: Updated all documentation to use `db:migrate` and match current Supabase implementation
**Details**:

- Updated `docs/dev/architecture/18_CICD-Pipeline.md` and `docs/dev/Complete-Stack-And-Architecture-Spec.md`
- Changed `pnpm db:push` → `pnpm db:migrate` in all CI/CD workflows
- Updated package.json script examples to match actual implementation
- Changed `test:ci` → `test:coverage` throughout documentation
- Removed outdated drizzle-related scripts from examples
- Key learning: Always check for documentation consistency after major refactoring

---

## 🧠 MEMORY ENTRY - PROJECT_SETUP - Phase 1 Foundation Implementation - HIGH (2025-09-19)

**Context**: Implemented Phase 1 of MVP Task Plan - Foundation & Infrastructure Setup for Savvy-Next LMS
**Issue/Challenge**: Starting from existing package.json but no source structure, needed to initialize SvelteKit project and configure all tools
**Solution**: Used npx sv create with interactive prompts, then configured all development tools and base application structure
**Details**:

- Used `npx sv create . --no-install` to initialize SvelteKit with TypeScript in existing directory
- Selected minimal template with TypeScript syntax support
- Manually ran `npx sv add tailwindcss` after initial setup (failed in create flow due to no pnpm)
- Used shadcn-svelte CLI for UI components: `npx shadcn-svelte@latest init` then `add button`
- Created complete directory structure using PowerShell script in scripts/create-directories.ps1
- Set up environment config with Zod validation in src/lib/config/env.ts
- Configured ESLint, Prettier, TailwindCSS, PostCSS manually (sv add didn't complete all)
- Key learning: Interactive shells in VS Code MCP use vi-style navigation (j/k for down/up)
- Important: Always use shadcn-svelte CLI for UI components, not manual creation

---

## 🧠 MEMORY ENTRY - SVELTEKIT - Import RequestHandler from @sveltejs/kit Not $types - CRITICAL (2025-09-30)

**Context**: SvelteKit type imports must come from @sveltejs/kit, not from './$types'
**Issue/Challenge**: Using `import type { RequestHandler } from './$types'` causes "Cannot find module './$types'" error
**Solution**: Always import SvelteKit types from @sveltejs/kit package
**Details**:

- ❌ WRONG: `import type { RequestHandler } from './$types'`
- ✅ CORRECT: `import type { RequestHandler } from '@sveltejs/kit'`
- The './$types' pattern is for route-specific types generated by SvelteKit (like PageData, PageServerData)
- Common types like RequestHandler, RequestEvent, LoadEvent, etc. come from @sveltejs/kit
- Key learning: Only use './$types' for auto-generated page/layout-specific types, all other SvelteKit types come from the main package

---

## 🧠 MEMORY ENTRY - SVELTE5 - Use $app/state Instead of Deprecated $app/stores - CRITICAL (2025-09-22)

**Context**: SvelteKit with Svelte 5 deprecated the old $app/stores imports in favor of new $app/state imports
**Issue/Challenge**: Using old imports like `import { page } from '$app/stores'` causes TypeScript deprecation warnings
**Solution**: Always use the new $app/state imports and access state values without $ prefix
**Details**:

- Replace `import { navigating } from '$app/stores'` → `import { navigating } from '$app/state'`
- Replace `import { page } from '$app/stores'` → `import { page } from '$app/state'`
- Replace `import { updated } from '$app/stores'` → `import { updated } from '$app/state'`
- Access state values without $ prefix:
  - `$navigating` becomes `navigating`
  - `$page` becomes `page`
- In templates: `{#if $navigating}` → `{#if navigating}`, `{$page.status}` → `{page.status}`
- These are now regular state values in Svelte 5, not stores, so no $ prefix needed
- Always check imports in +page.svelte, +layout.svelte, +error.svelte files
- Key learning: Svelte 5 runes mode changes how state is accessed - no more store subscriptions

---

## 🧠 MEMORY ENTRY - AUTHENTICATION - Custom Auth Endpoints with Better-Auth API - CRITICAL (2025-10-07)

**Context**: Architectural decision about authentication endpoint structure
**Issue/Challenge**: Whether to use Better-Auth's catch-all route (`/api/auth/[...all]`) or custom endpoints
**Solution**: Use custom auth endpoints that wrap Better-Auth API calls for full control
**Details**:

**Decision**: We use **CUSTOM auth endpoints** (NOT Better-Auth's catch-all route)

**Why Custom Endpoints:**

- Full control over rate limiting (3-9 attempts = 429, 10+ = account lock)
- Custom validation and error messages
- Failed login attempt tracking in database
- Account locking after 10 failed attempts (30 min)
- Structured logging with our universal logger
- Employee ID login support (planned)
- Ability to add custom business logic
- Better-Auth doesn't provide rate limiting out-of-box

**Pattern - Custom Endpoint Wrapping Better-Auth:**

```typescript
// src/routes/api/auth/login/+server.ts
import { auth } from '$lib/server/auth/better-auth';
import { APIError } from 'better-auth/api';

export const POST = async ({ request }: RequestEvent) => {
	// 1. Custom validation
	// 2. Custom rate limiting checks
	// 3. Call Better-Auth API with asResponse and returnHeaders
	const result = await auth.api.signInEmail({
		body: { email, password },
		asResponse: true, // Get Response object
		returnHeaders: true // Get headers with cookies
	});

	// 4. Forward Set-Cookie headers
	// 5. Custom logging
	// 6. Return response with cookies
};
```

**CRITICAL - Cookie Handling:**

- ALWAYS use `asResponse: true` AND `returnHeaders: true` when calling Better-Auth API
- ALWAYS forward `Set-Cookie` headers from Better-Auth to response
- Better-Auth sets `better-auth.session_token` cookie for session management
- Without proper cookie forwarding, logout and other endpoints won't work

**Endpoints Structure:**

- `/api/auth/login` - Custom (wraps Better-Auth signInEmail)
- `/api/auth/register` - Custom (wraps Better-Auth signUpEmail)
- `/api/auth/logout` - Custom (wraps Better-Auth signOut)
- `/api/auth/session` - Custom (wraps Better-Auth getSession)
- `/api/auth/refresh` - Custom (wraps Better-Auth refreshSession)
- `/api/auth/forgot-password` - Custom (wraps Better-Auth forgetPassword)
- `/api/auth/reset-password` - Custom (wraps Better-Auth resetPassword)
- NO catch-all route - deleted `/api/auth/[...all]`

**Key Learning**: Better-Auth is a library/framework, not a black box. We use its API methods as building blocks while maintaining full control over our authentication flow.

---

## 🧠 MEMORY ENTRY - AUTHENTICATION - Better-Auth API Response Types - CRITICAL (2025-10-07)

**Context**: Integration tests for login were failing because code incorrectly assumed Better-Auth returns Response objects
**Issue/Challenge**: Login route was checking `signInResult instanceof Response` and trying to call `.json()` on the result, causing 500 errors
**Solution**: Better-Auth API methods return plain JavaScript objects by default, NOT Response objects
**Details**:

- Better-Auth uses scrypt (NOT argon2) for password hashing by default
- By default, `auth.api.signInEmail()` returns plain object: `{user, session}` on success
- On failure, Better-Auth THROWS an `APIError` exception (doesn't return error object)
- Only when passing `asResponse: true` does it return a Response object
- Only when passing `returnHeaders: true` does it return headers
- Error handling: Wrap calls in try/catch and check for `APIError` instance
- Pattern for server-side Better-Auth calls:

  ```typescript
  import { APIError } from 'better-auth/api';

  try {
  	const { user, session } = await auth.api.signInEmail({
  		body: { email, password }
  	});
  	// Success - user and session are plain objects
  } catch (error) {
  	if (error instanceof APIError) {
  		// Handle auth failure
  		console.log(error.message, error.status);
  	}
  }
  ```

- This is CRITICAL for all Better-Auth API endpoint implementations
- Documentation: https://www.better-auth.com/docs/concepts/api

---

## 🧠 MEMORY ENTRY - AUTHENTICATION - Better-Auth Session Information Handling - CRITICAL (2025-10-13)

**Context**: Fixed failing integration tests for Better-Auth login endpoint by understanding how Better-Auth handles session tokens and database storage
**Issue/Challenge**: Login integration tests were failing because they expected session data in response body, but Better-Auth uses different patterns for session management
**Solution**: Better-Auth sets session as cookie in Set-Cookie header, uses compound tokens, and stores only part of token in database
**Details**:

### Key Session Architecture Insights:

**Better-Auth Session Token Structure**:

- Better-Auth uses compound session tokens: `tokenPart1.tokenPart2`
- Example: `TKFouui0WwUj24iFyZThG6h40EVv9rg2.D3HmR9V3Pn3woBtO+1S+7z/nanoZRCKJLnPaqY5RShE=`
- Cookie contains full compound token
- Database stores only first part (`TKFouui0WwUj24iFyZThG6h40EVv9rg2`) in `token` field
- Session `id` in database is separate unique identifier (not the token)

**Database Session Storage Pattern**:

- Sessions table structure: `{ id, token, userId, expiresAt, createdAt, ... }`
- Query sessions by `token` field using first part of compound token
- NOT by `id` field (that's a separate UUID)
- Pattern: `SELECT * FROM sessions WHERE token = 'tokenPart1'`

**Better-Auth Response Behavior with Custom Routes**:

- When using `asResponse: true` and `returnHeaders: true`:
  - Better-Auth returns Response object with Set-Cookie header
  - Session data may or may not be in response body (depends on endpoint)
  - Cookie handling is primary session mechanism
- Custom response format can wrap Better-Auth data: `{ success, data: { user }, message }`
- Session token is set via Set-Cookie header, not response body

**Integration Test Patterns**:

- Extract session cookie from Set-Cookie header: `savvy-session=tokenPart1.tokenPart2`
- Split token on '.' to get database query part: `tokenParts[0]`
- Query database: `supabase.from('sessions').select('*').eq('token', tokenParts[0]).single()`
- Verify session exists and has correct userId, expiresAt, etc.

**Cookie Extraction Pattern**:

```typescript
// Extract session cookie from Set-Cookie header
const setCookieHeader = response.headers.get('set-cookie');
const sessionMatch = setCookieHeader?.match(/savvy-session=([^;]+)/);
const sessionToken = sessionMatch?.[1];

// Decode URL-encoded session token
const decodedSessionToken = decodeURIComponent(sessionToken);

// Split compound token for database query
const tokenParts = decodedSessionToken.split('.');
const sessionTokenFirstPart = tokenParts[0];

// Query database using first part
const { data: session } = await supabase
	.from('sessions')
	.select('*')
	.eq('token', sessionTokenFirstPart)
	.single();
```

**Key Learning**: Better-Auth session architecture separates cookie management (full compound token) from database storage (first part only). Integration tests must understand this split to properly verify session creation and validation.

**Verification**: Fixed login integration test now passes (11/11) by using correct session token extraction and database query patterns.

---

## 🧠 MEMORY ENTRY - LOGGER - Universal Logger Implementation - CRITICAL (2025-09-23)

**Context**: Implemented a universal logger system to replace all console.log/error/warn usage, providing structured logging, file persistence, and VS Code pattern formatting

**Issue/Challenge**: ESLint restricts console methods; needed centralized logging with proper formatting, sanitization, and file rotation

**Solution**: Created Pino-based logger with custom transports for both server and client, supporting pattern-based logs for VS Code colorization

**Details**:

### Core Implementation Files:

- `src/lib/logger/index.ts` - Main exports (logger instance for server, getLogger() for client)
- `src/lib/logger/logger.ts` - Core logger factory using Pino
- `src/lib/logger/types.ts` - TypeScript interfaces (LogLevel, LogCategory, LogConfig, etc.)
- `src/lib/logger/config.ts` - Configuration loader with environment-based settings

### Transport System:

- `src/lib/logger/transports/server.ts` - Server-side transport with file rotation
- `src/lib/logger/transports/browser.ts` - Client-side transport with batching
- `src/lib/logger/transports/pattern-transport.ts` - Custom transport for VS Code pattern format
  - Format: `[YYYY-MM-DD HH:MM:SS.mmm] [LEVEL] [CATEGORY] message {metadata}`
  - This format enables VS Code's built-in log syntax highlighting

### Utilities:

- `src/lib/logger/utils/sanitizer.ts` - Removes sensitive data (passwords, tokens, etc.)
- `src/lib/logger/utils/timezone.ts` - Consistent timestamp formatting
- `src/lib/logger/utils/batching.ts` - Client-side log batching for performance

### Usage Patterns:

**Both Server-side and Client-side (always import from $lib/logger):**

```typescript
import { logger } from '$lib/logger';

// Basic logging
logger.info('Application started');
logger.warn('High memory usage', { usage: memoryUsage });
logger.error('Database error', { error, query });

// With categories (using child loggers)
logger.auth.info('User authenticated', { userId });
logger.cache.debug('Cache hit', { key });
logger.api.error('API call failed', { endpoint, status });
logger.performance.info('Operation completed', { duration });

// With custom context
const requestLogger = logger.child({ requestId, userId });
requestLogger.info('Processing request');
```

**Log Levels (in order):**

- TRACE (10) - Most detailed debugging
- DEBUG (20) - Debugging information
- INFO (30) - General information
- WARN (40) - Warning conditions
- ERROR (50) - Error conditions
- FATAL (60) - Critical errors

**Categories (for filtering/routing):**

- system, database, cache, auth, api, client, user, course, enrollment, quiz, performance, security, audit, analytics

### File Output Structure:

- Pattern logs: `logs/YYYY-MM-DD_app.log` (human-readable with VS Code highlighting)
- JSON logs: `logs/YYYY-MM-DD_app.ndjson` (newline-delimited JSON for parsing)
- Category logs: `logs/YYYY-MM-DD_[category].log` (security, auth, error)
- All logs rotate daily and compress when reaching 100MB

### Configuration (via environment variables):

- `LOG_LEVEL` - Minimum log level (default: 'info')
- `LOG_CONSOLE` - Enable console output (default: true)
- `LOG_FILE` - Enable file output (default: true)
- `LOG_PATH` - Directory for log files (default: 'logs')
- `LOG_RETENTION_DAYS` - Days to keep logs (default: 30)
- `LOG_TIMEZONE` - Timezone for timestamps (default: system timezone)

### Testing:

- Standalone test: `pnpm tsx src/lib/logger/test-logger-standalone.ts`
- Creates test-logs directory with sample output
- Verifies sanitization, formatting, and file creation

### Important Notes:

1. NEVER use console.log/error/warn - always use the logger
2. The logger automatically sanitizes sensitive fields (password, token, apiKey, etc.)
3. Client logs are batched and sent to `/api/logs` endpoint every 5 seconds
4. VS Code will colorize .log files if they follow the pattern format
5. Use appropriate log levels - don't use ERROR for warnings or INFO for debug
6. Always include relevant context objects for easier debugging
7. The pattern-transport.ts uses CommonJS require() due to Pino's worker thread requirements

---

## 🧠 MEMORY ENTRY - Authentication Files Refactor Complete - HIGH (2025-09-23)

**Context**: Completed Authentication Files Refactor (task 2.2.1) with all phases successfully implemented
**Success**: All authentication files now have proper typing with ZERO TypeScript errors and ZERO unexpected `any` types

**Key Achievements**:

1. **Phase 1**: Replaced all 19 console statements with logger across 6 authentication files
2. **Phase 2**: Fixed dependencies - replaced bcryptjs with @node-rs/argon2 for better security
3. **Phase 3**: Fixed all TypeScript errors with proper typing:
   - Removed all `any` type assertions from Supabase calls
   - Created proper interfaces for OrganizationSettings and OrganizationBranding
   - Supabase client already typed with Database interface from `$lib/types/database.ts`

**Technical Details**:

- The Supabase client in `src/lib/server/db/client.ts` is already properly typed with `createClient<Database>`
- No need for type assertions or `as any` - the Database types provide full type safety
- Fixed `Record<string, any>` in database.ts by creating specific interfaces
- All auth operations now have complete type safety

**Files Modified**:

- `src/lib/server/auth/adp-provider.ts` - removed all `any` assertions
- `src/lib/server/auth/session.ts` - fixed type errors and removed unused imports
- `src/lib/server/auth/magic-link.ts` - replaced console.log with logger
- `src/lib/server/auth/rate-limit.ts` - replaced console.error with logger
- `src/lib/server/db/pool.ts` - replaced console.error with logger
- `src/lib/server/services/redis.service.ts` - replaced all console statements
- `src/routes/api/auth/magic-link/+server.ts` - replaced console.error with logger
- `src/lib/types/database.ts` - removed all `any` types with proper interfaces

**Key Learning**: Always use the existing Database types from `$lib/types/database.ts` - they provide complete type safety for all Supabase operations without needing any type assertions.

---

## 🧠 MEMORY ENTRY - API - Authentication API Routes Implementation - HIGH (2025-09-30)

**Context**: Implemented Phase 2.2.2 - Create Authentication API Routes with comprehensive logging and error handling
**Issue/Challenge**: Needed standardized API response format, validation, and Better-Auth integration across all auth endpoints
**Solution**: Created type-safe API infrastructure with 8 authentication endpoints using Better-Auth
**Details**:

### Core Infrastructure:

- **src/lib/types/api.ts**: Standard response interfaces, error codes (17 types), HTTP status mapping, helper functions
- **src/lib/server/auth/utils.ts**: Email/password validation, Better-Auth error formatting, authentication event logging with data sanitization

### API Endpoints Created:

- **register** (`/api/auth/register`): User registration with field validation (email, password, names, terms acceptance)
- **login** (`/api/auth/login`): Email/password login with IP tracking and failed attempt logging
- **logout** (`/api/auth/logout`): Session termination with proper cleanup
- **session** (`/api/auth/session`): Current session validation and user info retrieval
- **refresh** (`/api/auth/refresh`): Session token refresh with automatic extension
- **forgot-password** (`/api/auth/forgot-password`): Password reset initiation (always returns success to prevent email enumeration)
- **reset-password** (`/api/auth/reset-password`): Password reset completion with token validation

### Key Patterns Established:

- Standard API response format: `{ success: boolean, data?: T, error?: { code, message, details } }`
- Comprehensive logging for all auth events with IP addresses and sanitized data
- Password strength validation: 8+ chars, uppercase, lowercase, number, special character
- Better-Auth integration for all authentication operations
- Security-first approach: email enumeration prevention, sensitive data sanitization

**Quality**: Zero TypeScript errors, zero ESLint warnings, all files properly formatted and linted

---

## 🧠 MEMORY ENTRY - TESTING - Standardized Test Directory Structure - CRITICAL (2025-09-30)

**Context**: Established single source of truth for test file locations to eliminate confusion
**Issue/Challenge**: Both /e2e and /tests/e2e existed, causing confusion about where to place tests
**Solution**: Consolidate ALL tests under /tests directory with clear structure by test type
**Details**:

**Standardized Test Directory Structure**:

```
tests/
├── unit/                    # Unit tests (Vitest) - Fast, isolated
│   ├── setup/              # ✅ PRESERVED - Setup validation tests
│   ├── lib/
│   │   ├── utils/          # Utility function tests
│   │   ├── stores/         # Svelte store tests
│   │   ├── server/         # Server-side unit tests (auth, services, db)
│   │   └── components/     # Svelte component tests
│   └── routes/             # Route handler unit tests
├── integration/            # Integration tests (Vitest) - API + DB
│   ├── auth/              # Auth flow integration tests
│   ├── courses/           # Course API integration tests
│   ├── quizzes/           # Quiz API integration tests
│   └── database/          # Database integration tests
├── e2e/                   # E2E tests (Playwright) - Complete user flows
│   ├── utils/             # ✅ PRESERVED - E2E test utilities
│   ├── fixtures/          # Playwright fixtures (auth, course)
│   └── *.spec.ts          # E2E test files
├── fixtures/              # Shared test data (all test types)
│   └── test-data.ts       # ✅ PRESERVED - Central test data
├── helpers/               # Test helper utilities
│   ├── db-helpers.ts      # Database test utilities
│   ├── api-helpers.ts     # API test utilities
│   └── auth-helpers.ts    # Auth test utilities
├── seeds/                 # Test database seed scripts
│   └── test-seed.ts       # Main test seed script
└── setup.ts               # ✅ PRESERVED - Global Vitest setup
```

**Naming Conventions**:

- Unit tests: `*.test.ts`
- Integration tests: `*.integration.test.ts`
- E2E tests: `*.spec.ts` (Playwright convention)
- Svelte test wrappers: `*.test.svelte`
- Storybook stories: `*.stories.ts` (in src/, not tests/)

**Actions Taken**:

- Moved `/e2e/demo.test.ts` → `/tests/e2e/demo.spec.ts`
- Deleted `/e2e` directory
- Preserved existing: tests/unit/setup/, tests/e2e/utils/, tests/fixtures/
- Created tests/helpers/ for shared utilities
- Created tests/seeds/ for database seeding

**Key Principles**:

- Single source of truth: ALL tests under /tests/
- Clear separation by test type (unit/integration/e2e)
- Mirrors source structure: tests/unit/lib/utils mirrors src/lib/utils
- Follow conventions: Playwright uses .spec.ts, Vitest uses .test.ts

**Reference**: See `docs/dev/TDD-Workflow-Enhancement-Plan-FINAL.md` for complete details

---

## 🧠 MEMORY ENTRY - TESTING - Step 2.2.2 Completed Without TDD - HIGH (2025-09-30)

**Context**: Step 2.2.2 (Create Authentication API Routes) was completed without following TDD workflow
**Issue/Challenge**: Tests were not written before implementation, violating TDD principles and leaving code untested
**Solution**: Document what tests SHOULD have been created and create detailed task plan for retroactive test creation
**Details**:

**What Should Have Been Done (TDD Process)**:

1. Create `phase-2.2.2-tests` branch
2. Write failing tests for all 7 auth API endpoints
3. Write unit tests for auth utilities
4. Merge tests to main
5. Create `phase-2.2.2-auth-api-routes` branch
6. Implement minimal code to pass tests
7. Refactor while keeping tests green
8. Merge implementation to main

**What Actually Happened**:

1. Created `phase-2.2.2-auth-api-routes` branch
2. Implemented all auth API routes without tests
3. Merged to main
4. Zero tests exist for authentication routes
5. No safety net for refactoring
6. No verification of edge cases
7. No documentation of expected behavior

**Impact of Missing Tests**:

- Authentication system has no safety net
- Can't refactor with confidence
- Unknown edge cases may exist
- Regressions could go undetected
- Security vulnerabilities may exist
- No living documentation of auth flows

**Tests That Must Be Created** (See retroactive task plan below):

**Unit Tests** (tests/unit/lib/server/auth/):

- `utils.test.ts` - 7 test suites, ~15 test cases
- `rate-limit.test.ts` - 6 test cases

**Integration Tests** (tests/integration/auth/):

- `register.integration.test.ts` - 8 test cases
- `login.integration.test.ts` - 8 test cases
- `logout.integration.test.ts` - 3 test cases
- `session.integration.test.ts` - 4 test cases
- `refresh.integration.test.ts` - 3 test cases
- `password-reset.integration.test.ts` - 8 test cases

**E2E Tests** (tests/e2e/):

- `auth.spec.ts` - 6 complete user flow tests

**Total**: ~60 test cases across 9 test files

**Key Learning**: Always follow TDD workflow for ALL future steps to avoid technical debt, ensure security, and maintain code quality. The time "saved" by skipping tests is lost many times over in debugging, regressions, and fear of refactoring.

**Prevention**: The new TDD Workflow critical rule (2025-09-30) makes TDD mandatory for all future steps.

---

## 🧠 MEMORY ENTRY - TESTING - Frontend Requirements Document for Auth E2E Tests - HIGH (2025-10-13)

**Context**: Created comprehensive frontend requirements document specifying exact implementation needed to pass E2E authentication tests
**Issue/Challenge**: E2E tests were written in RED phase (TDD) before frontend exists, need clear specification for frontend developers
**Solution**: Created detailed requirements document with all pages, components, API integration, and test IDs needed
**Details**:

- Document location: `docs/frontend-requirements-auth-e2e.md`
- Specifies 5 required pages: /register, /login, /dashboard, /forgot-password, /reset-password
- Details all form fields, validation rules, success/error behaviors
- Lists all required `data-testid` attributes for E2E test selectors
- Documents API integration requirements and response formats
- Includes session management and cookie handling specifications
- Provides accessibility requirements (ARIA, keyboard navigation)
- Contains testing guidance for frontend developers
- Implementation priority: Phase 1 (basic auth) → Phase 2 (password reset) → Phase 3 (polish)
- Success criteria: All 60 E2E tests in `tests/e2e/auth.spec.ts` pass
- Key principle: E2E tests serve as acceptance criteria and living documentation
- Frontend implementation will happen in future MVP phases (Phase 5-6)

---

## 🧠 MEMORY ENTRY - TESTING - Browser-Safe Test Setup for Vitest - HIGH (2025-10-07)

**Context**: Storybook tests were failing with `ReferenceError: process is not defined` error
**Issue/Challenge**: tests/setup.ts was using process.cwd() unconditionally, but Storybook tests run in browser environment where process global doesn't exist
**Solution**: Made environment variable loading conditional based on Node.js environment detection
**Details**:

**Problem**:

- Vitest config uses `extends: true` which inherits root setupFiles
- Storybook tests run in Playwright browser (no Node.js globals like `process`)
- Unit tests run in jsdom (has process mock)
- Integration tests run in Node environment (has real process)
- One setup file (tests/setup.ts) must work in ALL three environments

**Solution Pattern**:

```typescript
// tests/setup.ts - Environment-aware setup

// Load environment variables ONLY in Node.js environments
// Skip in browser environments (Storybook, browser-mode tests)
if (typeof process !== 'undefined' && process.versions && process.versions.node) {
	const { config } = await import('dotenv');
	const { resolve } = await import('path');
	// Load .env.local file (used for both dev and test)
	config({ path: resolve(process.cwd(), '.env.local') });
}

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/svelte';
import { afterEach } from 'vitest';
// ... rest of setup code
```

**Key Points**:

- Check for Node.js environment: `typeof process !== 'undefined' && process.versions && process.versions.node`
- Use dynamic imports for Node.js-only modules (`dotenv`, `path`)
- Conditional loading ensures browser tests don't break
- All 8 Storybook tests now pass ✅

**Vitest Config Context**:

```typescript
export default defineConfig({
	test: {
		setupFiles: ['./tests/setup.ts'], // Used by root config
		projects: [
			{
				extends: true, // Inherits root setupFiles!
				test: { name: 'unit', environment: 'jsdom' }
			},
			{
				extends: true, // Inherits root setupFiles!
				plugins: [storybookTest()],
				test: {
					name: 'storybook',
					browser: { enabled: true } // Browser = no process global!
				}
			}
		]
	}
});
```

**Result**: All test environments work correctly with single setup file

---

# TESTING INFORMATION SECTION

## 🧪 TESTING INFORMATION - Comprehensive TDD Testing Guide - CRITICAL (2025-10-01)

**Test Status**: ✅ GUIDE COMPLETE

**Context**: Comprehensive guide for Test-Driven Development covering all test types, database strategies, and best practices

**Reference**: `docs/dev/TDD-Workflow-Enhancement-Plan-FINAL.md`

**Key Test Cases**: This entry provides complete testing patterns for all scenarios

**Implementation Details**: Frameworks, tools, and specific patterns for each test type

### **Test Type Guidelines by Component**:

#### **Unit Tests** (tests/unit/) - Vitest ⚡

**Purpose**: Test individual functions/classes in complete isolation  
**Speed**: Fast (< 1ms per test)  
**Scope**: Pure functions, utilities, services (mocked dependencies)

**What to Unit Test**:

- ✅ Utility functions (format, validation, helpers)
- ✅ Business logic functions
- ✅ Service classes with mocked dependencies
- ✅ Svelte stores (state management)
- ✅ Data transformations
- ✅ Algorithms and calculations
- ✅ Validation schemas (Zod)

**What NOT to Unit Test**:

- ❌ Database queries (use integration tests)
- ❌ API endpoints (use integration tests)
- ❌ External service calls (use integration tests with mocks)
- ❌ File I/O operations (use integration tests)

**Location**: `tests/unit/`  
**Naming**: `*.test.ts`

**Pattern Example**:

```typescript
import { describe, it, expect } from 'vitest';
import { formatDate } from '$lib/utils/format';

describe('formatDate', () => {
	it('formats date with default format', () => {
		const date = new Date('2024-01-15T10:30:00Z');
		expect(formatDate(date)).toBe('January 15, 2024');
	});

	it('handles null dates gracefully', () => {
		expect(formatDate(null)).toBe('—');
	});
});
```

---

#### **Integration Tests** (tests/integration/) - Vitest 🔗

**Purpose**: Test how components work together (API + DB, Service + Cache, etc)  
**Speed**: Medium (10-100ms per test)  
**Scope**: API endpoints, database queries, external service integration

**What to Integration Test**:

- ✅ API endpoints with real database (test database)
- ✅ Authentication flows (login, logout, session validation)
- ✅ Database queries and transactions
- ✅ File upload/download with storage
- ✅ Email sending (with mock SMTP server)
- ✅ Cache interactions (Redis)
- ✅ External API calls (with mocked responses)
- ✅ Repository pattern implementations

**What NOT to Integration Test**:

- ❌ Pure utility functions (use unit tests)
- ❌ Complete user workflows across pages (use E2E tests)
- ❌ Browser-specific behavior (use E2E tests)

**Location**: `tests/integration/`  
**Naming**: `*.integration.test.ts`

---

### **Database Strategy**:

**Use separate test database** (`savvy_next_test`) - NEVER production!

**Two Database Testing Approaches**:

#### **Approach 1: Transaction Rollback (Recommended for Unit-like Integration Tests)**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '$lib/server/db';

let transaction;

beforeEach(async () => {
	transaction = await db.transaction();
});

afterEach(async () => {
	await transaction.rollback(); // Automatic cleanup!
});

describe('Course CRUD Operations', () => {
	it('creates a new course', async () => {
		const course = await createCourse({
			title: 'Test Course',
			description: 'Test Description'
		});
		expect(course.id).toBeDefined();
	});
	// Data automatically cleaned up by rollback!
});
```

#### **Approach 2: Full Database Reset (For True Integration Tests)**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resetTestDatabase, seedTestDatabase } from '../../helpers/db-helpers';

describe('POST /api/auth/login', () => {
	beforeEach(async () => {
		await resetTestDatabase(); // Reset entire database to clean state
		await seedTestDatabase(); // Seed with known test data
	});

	afterEach(async () => {
		await cleanupTestDatabase();
	});

	it('logs in user with valid credentials', async () => {
		const response = await fetch('http://localhost:5173/api/auth/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				email: 'test@example.com',
				password: 'Test123!'
			})
		});

		expect(response.ok).toBe(true);
		const data = await response.json();
		expect(data.success).toBe(true);
	});
});
```

---

### **Database Helper Utilities**:

```typescript
// tests/helpers/db-helpers.ts
import { supabase } from '$lib/server/db/client';

export async function resetTestDatabase() {
	// Truncate all tables in correct order due to foreign keys
	await supabase.from('lesson_progress').delete().neq('id', '00000000-0000-0000-0000-000000000000');
	await supabase
		.from('course_enrollments')
		.delete()
		.neq('id', '00000000-0000-0000-0000-000000000000');
	await supabase.from('quizzes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
	await supabase.from('lessons').delete().neq('id', '00000000-0000-0000-0000-000000000000');
	await supabase.from('courses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
	await supabase.from('profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
	await supabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000');
}

export async function seedTestDatabase() {
	// Import and run seed script
	await seedData();
}

export async function cleanupTestDatabase() {
	await resetTestDatabase();
}
```

---

### **Environment Configuration**:

```bash
# .env.test
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/savvy_next_test"
SUPABASE_URL="http://localhost:54321"  # Local Supabase
SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_KEY="..."
```

---

### **Setup Test Database**:

```bash
# Run PowerShell script to set up test database
.\scripts\setup-test-db.ps1

# Or reset existing test database
.\scripts\setup-test-db.ps1 -Reset
```

The script runs migrations in explicit order: 01 → 02 → 03 → 04

---

#### **Svelte Component Tests** (tests/unit/lib/components/) - Vitest + Testing Library 🎨

**Purpose**: Test component logic, rendering, and user interactions  
**Speed**: Fast to Medium (5-50ms per test)  
**Scope**: Component behavior, props, events, slots, conditional rendering

**What to Component Test**:

- ✅ Component renders correctly with different props
- ✅ User interactions (clicks, input changes, form submissions)
- ✅ Conditional rendering based on props/state
- ✅ Event emission and handling
- ✅ Form validation messages
- ✅ Accessibility (ARIA attributes, keyboard navigation)
- ✅ Slot rendering

**What NOT to Component Test**:

- ❌ Visual appearance (use Storybook + visual regression)
- ❌ API calls (mock these)
- ❌ Database operations (mock these)
- ❌ Complete user flows (use E2E tests)

**Location**: `tests/unit/lib/components/`  
**Naming**: `*.test.ts` with companion `.test.svelte` wrapper

**Pattern Example**:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import Button from '$lib/components/ui/button/button.svelte';

describe('Button Component', () => {
	it('handles click events', async () => {
		const handleClick = vi.fn();
		const { getByRole } = render(Button, {
			props: { children: 'Click me', onclick: handleClick }
		});

		await fireEvent.click(getByRole('button'));
		expect(handleClick).toHaveBeenCalledOnce();
	});

	it('disables button when loading', () => {
		const { getByRole } = render(Button, {
			props: { children: 'Loading', loading: true }
		});

		const button = getByRole('button');
		expect(button).toBeDisabled();
	});
});
```

---

#### **Storybook Stories** (src/lib/components/\*_/_.stories.ts) - NOT TESTS 📚

**Purpose**: Visual component documentation and manual testing  
**Speed**: N/A (not automated tests)  
**Scope**: Component variants, states, and usage examples

**What to Document in Storybook**:

- ✅ All UI components (buttons, inputs, cards, modals, etc.)
- ✅ Different variants (primary, secondary, destructive, outline)
- ✅ Different sizes (sm, md, lg, xl)
- ✅ Different states (default, hover, active, disabled, loading, error)
- ✅ Edge cases (long text, no data, empty states, errors)
- ✅ Accessibility features and keyboard navigation
- ✅ Responsive behavior
- ✅ Dark mode variations

**When to Create Stories**:

- ⏰ Create stories AFTER tests pass (part of refactor/documentation phase)
- Stories are living documentation, NOT tests
- Useful for designers to see component variants
- Useful for developers to understand component usage
- Can be used for visual regression testing with Chromatic (optional)

**Location**: Co-located with component: `src/lib/components/ui/button/button.stories.ts`

---

#### **E2E Tests** (tests/e2e/) - Playwright 🌐

**Purpose**: Test complete user workflows across multiple pages in real browser  
**Speed**: Slow (1-10 seconds per test)  
**Scope**: Critical user journeys, multi-page flows, real browser interactions

**What to E2E Test** (Only Critical Paths!):

- ✅ User registration → email verification → login → dashboard
- ✅ Login → browse courses → enroll → view lesson → take quiz → certificate
- ✅ Admin creates course → publishes → student enrolls → completes
- ✅ Password reset complete flow
- ✅ Payment/checkout flows (if applicable)
- ✅ Critical business workflows that involve multiple features

**What NOT to E2E Test**:

- ❌ Individual component behavior (use component tests)
- ❌ API endpoints directly (use integration tests)
- ❌ Every single page/feature (too slow and brittle)
- ❌ Edge cases and error handling (use unit/integration tests)

**Location**: `tests/e2e/`  
**Naming**: `*.spec.ts`

**Pattern Example**:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
	test('user can register, login, and logout', async ({ page }) => {
		// Registration
		await page.goto('/register');
		await page.fill('input[name="email"]', 'newuser@example.com');
		await page.fill('input[name="password"]', 'Test123!');
		await page.click('button[type="submit"]');

		// Should redirect to login
		await expect(page).toHaveURL('/login');

		// Login
		await page.fill('input[name="email"]', 'newuser@example.com');
		await page.fill('input[name="password"]', 'Test123!');
		await page.click('button[type="submit"]');

		// Should be on dashboard
		await expect(page).toHaveURL('/dashboard');
		await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();

		// Logout
		await page.click('[data-testid="user-menu"]');
		await page.click('text=Logout');
		await expect(page).toHaveURL('/login');
	});
});
```

**E2E Best Practices**:

1. Use `data-testid` attributes for stable selectors
2. Use page object pattern for complex flows
3. Use fixtures for authentication state
4. Keep tests independent - one test shouldn't depend on another
5. Clean up test data after each test
6. Use realistic test data
7. Test only critical user paths

---

### **Minimum Viable Tests (MVT) Approach**:

For complex steps, prioritize tests using the MVT methodology:

#### **Tier 1: MUST-HAVE (Create First - MVT)**

1. ✅ Happy path unit tests for core business logic
2. ✅ Critical API endpoint integration tests (CRUD operations)
3. ✅ ONE E2E test for the primary user workflow
4. ✅ Database integration tests for critical queries

#### **Tier 2: SHOULD-HAVE (Add After MVT Passing)**

1. ⭐ Edge case unit tests (null, empty, boundary values)
2. ⭐ Error handling integration tests
3. ⭐ Authentication/authorization tests
4. ⭐ Additional E2E tests for secondary workflows

#### **Tier 3: NICE-TO-HAVE (Add If Time Permits)**

1. 💎 Performance tests
2. 💎 Visual regression tests
3. 💎 Accessibility tests
4. 💎 Load/stress tests
5. 💎 Compatibility tests (different browsers/devices)

---

### **Exploratory Prototyping Exception**:

TDD is mandatory for production code, but exploratory prototyping is allowed under strict conditions:

**When Prototyping is Acceptable**:

- ✅ Exploring new libraries or unfamiliar technologies
- ✅ Proof-of-concept for complex/uncertain features
- ✅ UI design experimentation and iteration
- ✅ Performance testing different implementation approaches
- ✅ Spike solutions to validate technical feasibility

**Strict Rules for Prototyping**:

1. **Separate Branch**: Work in `prototype-*` branch only
2. **Clear Commits**: Mark ALL commits with `prototype:` prefix
3. **Time-Boxed**: Set time limit (e.g., 2 hours max)
4. **Document Learnings**: Write summary of what you learned
5. **Delete Prototype**: Once approach validated, DELETE ALL prototype code
6. **Start Fresh with TDD**: Begin new branch with tests first, using lessons learned
7. **NEVER Merge**: Prototype code NEVER merged to main - it's throwaway!

**Prototyping Pattern**:

```bash
# Prototyping phase
git checkout -b prototype-video-player-evaluation
git commit --allow-empty -m "prototype: start - evaluating video.js vs plyr.io"

# Experiment and document decision
git commit -m "prototype: decision - use plyr.io (better mobile support)"

# Once decided, THROW AWAY prototype
git checkout main
git branch -D prototype-video-player-evaluation  # DELETE PROTOTYPE!

# Start fresh with TDD
git checkout -b phase-6.2.1-video-player
# Write tests FIRST based on prototype learnings
# Then implement with chosen solution
```

**What Prototyping Is NOT**:

- ❌ NOT a way to skip TDD
- ❌ NOT production code
- ❌ NOT refactoring (that's part of TDD)
- ❌ NOT a way to "save time" (you'll waste time later)

---

### **What Breaks Without TDD**:

- ❌ **No safety net** for refactoring - fear of breaking things paralyzes development
- ❌ **Tests written after** code follow implementation biases - they test what you built, not what you need
- ❌ **Missing edge cases** - only test happy path because that's what you implemented
- ❌ **Poor API design** - don't consider testability or usability during design
- ❌ **Regressions** go undetected until production - manual testing misses things
- ❌ **Hard to understand** code - tests are living documentation, without them code is opaque
- ❌ **Hard to maintain** - changing code breaks things in unexpected ways
- ❌ **No confidence** in deployments - afraid to release because uncertain if things work
- ❌ **Technical debt** accumulates - untested code becomes "scary" to touch
- ❌ **Debugging takes longer** - without tests, must manually reproduce issues

---

### **Benefits of TDD**:

- ✅ **Immediate feedback** - know instantly if code works
- ✅ **Better design** - testable code is well-designed code
- ✅ **Living documentation** - tests show how code should be used
- ✅ **Fearless refactoring** - tests catch regressions immediately
- ✅ **Fewer bugs** - catch issues before they reach production
- ✅ **Faster debugging** - failing test shows exactly what broke
- ✅ **Confidence** - deploy knowing everything works
- ✅ **Reduced stress** - no fear of breaking things

---

### **Verification Checklist** (Before Completing Any Step):

- [ ] Tests existed BEFORE implementation (Red)
- [ ] Tests failed initially - proved they test something
- [ ] All tests pass after implementation (Green)
- [ ] Code refactored with passing tests (Refactor)
- [ ] Code coverage meets threshold (≥80% for new code)
- [ ] Zero TypeScript errors (get_diagnostics_code)
- [ ] Zero ESLint warnings (pnpm lint)
- [ ] Prettier formatting applied (pnpm format)
- [ ] All quality checks pass
- [ ] Storybook stories created for UI components (if applicable)
- [ ] MVP Task Plan checkboxes updated

---

**Lessons Learned**:

- TDD is not optional - it's mandatory for all production code
- Tests written first lead to better API design
- MVT approach balances speed with quality
- Database strategy must be chosen based on test type
- Prototyping is allowed but code must be deleted
- Comprehensive testing prevents production bugs

**Files**: See `docs/dev/TDD-Workflow-Enhancement-Plan-FINAL.md` for complete details and examples

**Priority Levels**: 🚨 CRITICAL - This guide is essential for maintaining code quality

---

## 🔧 TOOL USAGE PATTERN - Vitest + Svelte Component Testing - Complete Reference Pattern (2025-10-01)

**Mandatory Pattern**: Use proper Vitest configuration with Svelte plugins and follow official testing patterns

**Key Requirements**:

- Vitest config must have `extends: true` in unit test project to inherit root Svelte plugins
- Use @testing-library/svelte for component testing (not raw mount() unless necessary)
- Create wrapper components for advanced Svelte 5 features (context, bindings, snippets)
- Use `flushSync()` for synchronous state updates in tests
- Use `$effect.root()` when testing code with effects outside components

**Why This Pattern**:

- Vitest projects with custom plugins override root plugins unless `extends: true` is set
- Testing Library provides better abstractions and query methods than raw Svelte API
- Wrapper components handle Svelte features that have no programmatic API
- Without proper plugin configuration, Svelte files fail to parse with Vite errors

**Vitest Configuration Pattern**:

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import { svelteTesting } from '@testing-library/svelte/vite';

const sveltekitPlugins = await sveltekit();

export default defineConfig({
	// Root plugins - available to all projects that use extends: true
	plugins: [svelteTesting(), ...sveltekitPlugins],

	test: {
		include: ['tests/unit/**/*.{test,spec}.{js,ts}'],
		exclude: ['tests/e2e/**/*'],
		globals: true,
		environment: 'jsdom',
		setupFiles: ['./tests/setup.ts'],

		projects: [
			// Unit test project
			{
				extends: true, // CRITICAL: Inherits root plugins!
				test: {
					name: 'unit',
					include: ['tests/unit/**/*.{test,spec}.{js,ts}'],
					environment: 'jsdom'
				}
			},
			// Storybook project with its own plugins
			{
				extends: true, // Still needs extends for base config
				plugins: [storybookTest()], // Additional plugins
				test: {
					name: 'storybook',
					browser: { enabled: true }
				}
			}
		]
	}
});
```

**Basic Component Testing Pattern (Simple Components)**:

```typescript
// tests/unit/lib/components/Button.test.ts
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import Button from '$lib/components/ui/button/button.svelte';

describe('Button Component', () => {
	it('renders with text', () => {
		render(Button, { props: { children: 'Click me' } });

		expect(screen.getByRole('button')).toHaveTextContent('Click me');
	});

	it('handles click events', async () => {
		const user = userEvent.setup();
		const handleClick = vi.fn();

		render(Button, { props: { children: 'Click me', onclick: handleClick } });

		await user.click(screen.getByRole('button'));
		expect(handleClick).toHaveBeenCalledOnce();
	});

	it('disables when loading', () => {
		render(Button, { props: { children: 'Loading', loading: true } });

		const button = screen.getByRole('button');
		expect(button).toBeDisabled();
	});

	it('changes props reactively', async () => {
		const { component } = render(Button, { props: { children: 'Initial' } });

		await component.$set({ children: 'Updated' });
		expect(screen.getByRole('button')).toHaveTextContent('Updated');
	});
});
```

**Advanced Pattern: Wrapper Component for Context/Bindings/Snippets**:

When testing components that use Svelte 5 features like context, two-way bindings, or snippets, create a wrapper component:

```svelte
<!-- tests/unit/lib/components/ChildComponent.test.svelte -->
<script>
	import { setContext } from 'svelte';
	import ChildComponent from '$lib/components/ChildComponent.svelte';

	// Props to configure the test
	let { contextKey, contextValue, bindingValue = $bindable() } = $props();

	// Set up context for child
	setContext(contextKey, contextValue);
</script>

<ChildComponent bind:value={bindingValue} />
```

```typescript
// tests/unit/lib/components/ChildComponent.test.ts
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ChildComponentWrapper from './ChildComponent.test.svelte';

describe('ChildComponent with Context', () => {
	it('reads context value', () => {
		render(ChildComponentWrapper, {
			props: {
				contextKey: 'theme',
				contextValue: { mode: 'dark' }
			}
		});

		// Assert component uses context correctly
		expect(screen.getByTestId('theme-display')).toHaveTextContent('dark');
	});

	it('handles two-way binding', async () => {
		const { component } = render(ChildComponentWrapper, {
			props: {
				contextKey: 'theme',
				contextValue: { mode: 'light' },
				bindingValue: 'initial'
			}
		});

		// Component updates the binding
		await userEvent.click(screen.getByRole('button', { name: 'Update' }));

		// Check binding was updated
		expect(component.bindingValue).toBe('updated');
	});
});
```

**Testing Slots**:

```svelte
<!-- tests/unit/lib/components/Card.test.svelte -->
<script>
	import Card from '$lib/components/Card.svelte';
	let { Component } = $props();
</script>

<svelte:component this={Component}>
	<h1 data-testid="slotted-content">Test Content</h1>
</svelte:component>
```

```typescript
import { render } from '@testing-library/svelte';
import CardWrapper from './Card.test.svelte';
import Card from '$lib/components/Card.svelte';

it('renders slotted content', () => {
	const { getByTestId } = render(CardWrapper, {
		props: { Component: Card }
	});

	expect(getByTestId('slotted-content')).toBeInTheDocument();
});
```

**Testing Runes in Test Files**:

You can use runes directly in `.svelte.test.ts` files:

```typescript
// multiplier.svelte.test.ts
import { flushSync } from 'svelte';
import { test, expect } from 'vitest';
import { multiplier } from './multiplier.svelte.js';

test('Multiplier with runes', () => {
	let count = $state(0);
	let double = multiplier(() => count, 2);

	expect(double.value).toEqual(0);

	count = 5;
	flushSync(); // Flush state updates synchronously
	expect(double.value).toEqual(10);
});
```

**Testing Effects**:

Wrap tests that use `$effect` in `$effect.root()`:

```typescript
// logger.svelte.test.ts
import { flushSync } from 'svelte';
import { test, expect } from 'vitest';
import { logger } from './logger.svelte.js';

test('Effect tracking', () => {
	const cleanup = $effect.root(() => {
		let count = $state(0);
		let log = logger(() => count);

		flushSync();
		expect(log).toEqual([0]);

		count = 1;
		flushSync();
		expect(log).toEqual([0, 1]);
	});

	cleanup(); // Clean up the effect root
});
```

**Query Priority (from Testing Library)**:

Use queries in this priority order:

1. **getByRole** - Most accessible (buttons, links, inputs)
2. **getByLabelText** - Form fields with labels
3. **getByPlaceholderText** - Form fields with placeholders
4. **getByText** - Non-form text content
5. **getByDisplayValue** - Form fields with values
6. **getByAltText** - Images with alt text
7. **getByTitle** - Elements with title attribute
8. **getByTestId** - Last resort with data-testid

**Common Mistakes**:

❌ **WRONG** - Missing `extends: true` in projects:

```typescript
projects: [
	{
		test: { name: 'unit' } // Won't inherit root plugins!
	}
];
```

❌ **WRONG** - Using raw mount() for simple tests:

```typescript
import { mount } from 'svelte';
const component = mount(Component, { target: document.body });
// Harder to query and assert
```

❌ **WRONG** - Not using flushSync for state updates:

```typescript
count = 5;
expect(double.value).toEqual(10); // May fail - not flushed!
```

❌ **WRONG** - Testing complex features without wrapper:

```typescript
// Trying to test context without wrapper - won't work!
render(ChildComponent); // No context set!
```

✅ **CORRECT** - All patterns above:

- Extends root config
- Uses Testing Library
- Uses flushSync
- Uses wrapper for advanced features

**Example Usage from Our Project**:

```typescript
// tests/unit/routes/page.test.ts
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Page from '../../../src/routes/+page.svelte';

describe('+page.svelte', () => {
	it('renders welcome heading', () => {
		render(Page);

		const heading = screen.getByRole('heading', { level: 1 });
		expect(heading).toBeInTheDocument();
	});

	it('renders call-to-action buttons', () => {
		render(Page);

		const getStartedButton = screen.getByRole('link', { name: /get started/i });
		expect(getStartedButton).toHaveAttribute('href', '/login');
	});
});
```

**What Breaks Without This**:

- Missing `extends: true`: Vite parsing errors like "Failed to parse source for import analysis"
- No wrapper for context: Child component can't access context, tests fail
- No flushSync: Race conditions in tests, intermittent failures
- Using wrong queries: Tests break with minor HTML changes
- Not using Testing Library: Tests are brittle and harder to maintain

**Verification**:

1. Run `pnpm test:unit --run` - all tests pass
2. Check vitest.config.ts - unit project has `extends: true`
3. Tests use `screen` queries from Testing Library
4. Complex components have wrapper test files (.test.svelte)
5. State updates use `flushSync()` where needed

**Reference Documentation**:

- Official Svelte Testing: https://svelte.dev/docs/svelte/testing
- Testing Library Svelte: https://testing-library.com/docs/svelte-testing-library/example/
- Svelte Society Recipes: https://www.sveltesociety.dev/recipes/testing-and-debugging/unit-testing-svelte-component

**Key Takeaways**:

1. **Configuration First**: Always ensure `extends: true` in Vitest projects
2. **Use Testing Library**: Better abstractions than raw Svelte API
3. **Wrapper Components**: Required for context, bindings, snippets
4. **flushSync Everywhere**: Svelte updates are async, flush for deterministic tests
5. **Query Wisely**: Prefer accessible queries (getByRole) over test IDs

---

# TASK PLAN SECTION

## 📋 TASK PLAN - Enhance MVP Task Plan Testing Requirements - MEDIUM (2025-10-14)

**Date Created**: 2025-10-14
**Status**: [ ] NOT_STARTED
**Priority**: 📋 MEDIUM - Critical for maintaining TDD discipline across entire project

---

### Goal

Update ALL Testing Requirements sections in `docs/dev/MVP-Implementation-Task-Plan.md` with:

1. **Phase-level testing specifications** - Detailed test files, test cases, and strategies
2. **Step-level TDD integration** - Each implementation step explicitly references and completes its tests BEFORE implementation
3. **Quality gates and verification** - Clear checkpoints preventing progress without passing tests

**Single Source of Truth**: After completion, the MVP Task Plan will be the authoritative guide for TDD implementation.

---

### Why This Matters

#### Phase-Level Benefits:

- Provides complete test roadmap for each phase
- Identifies all test files and test cases needed
- Clarifies database testing strategies
- Estimates testing effort accurately
- Prevents missing critical test coverage

#### Step-Level Benefits:

- **Enforces TDD at granular step level** (not just phase level)
- **Creates clear dependency chain**: tests written → tests failing → implementation → tests passing
- **Prevents implementation-first approach** that violates TDD principles
- **Makes each step self-contained** with clear entry/exit criteria
- **Enables precise progress tracking** (step not "complete" until tests pass)
- **Provides recovery context** (after interruption, see exactly what's tested and what's complete)
- **Creates accountability** (cannot skip tests, cannot skip quality checks)

#### Project-Wide Benefits:

- Comprehensive test coverage across all MVP features
- Living documentation of expected behavior
- Safety net for refactoring and feature additions
- Confidence in deployments
- Reduced debugging time
- Prevention of regressions

---

### Prerequisites

Before starting this task, ensure you have:

- [x] Read CLAUDE.md completely (especially TDD Workflow critical rule)
- [ ] Read `docs/dev/MVP-Implementation-Task-Plan.md` completely to understand all phases
- [ ] Read `docs/dev/architecture/17_Testing-Strategy.md` for testing patterns
- [ ] Understand the project's test directory structure (`tests/unit/`, `tests/integration/`, `tests/e2e/`)
- [ ] Understand Vitest projects configuration (unit, integration, storybook)
- [ ] Understand database testing strategies (transaction rollback vs full reset)

---

### Understanding the MVP Task Plan Structure

#### Current Phase Structure (Example: Phase 2)

```markdown
## Phase 2: Authentication & User Management System

- [ ] **Phase 2 Complete**

### Objective

[High-level goal description]

### Required Architecture Documents

- [ ] Read document 1
- [ ] Read document 2

### Detailed Implementation Steps

#### 2.1 [Main Step Name]

- [ ] **2.1 Complete**

  **2.1.1 [Sub-step Name]**
  - [ ] Task item 1
  - [ ] Task item 2
  - [ ] Task item 3

  **2.1.2 [Sub-step Name]**
  - [ ] Task item 1
  - [ ] Task item 2

#### 2.2 [Main Step Name]

- [ ] **2.2 Complete**

  **2.2.1 [Sub-step Name]**
  - [ ] Task item 1
  - [ ] Task item 2

  **2.2.2 [Sub-step Name]**
  - [ ] Task item 1
  - [ ] Task item 2

### Testing Requirements

- [ ] Generic requirement 1
- [ ] Generic requirement 2
- [ ] Generic requirement 3

### Deliverables

- [ ] Deliverable 1
- [ ] Deliverable 2
```

#### Target Enhanced Structure

After enhancement, each phase will have:

1. **Enhanced Testing Requirements Section** (Phase-Level)
   - Specific test file paths and purposes
   - Enumerated test cases for each file
   - MVT (Tier 1) vs Nice-to-Have (Tier 2/3) prioritization
   - Database testing strategy (if applicable)
   - Storybook guidance (if UI components)
   - Test effort estimation
   - Step integration instructions

2. **Enhanced Implementation Steps** (Step-Level)
   - Each sub-step (e.g., 2.2.2) will be transformed from simple task list to complete TDD workflow:
     - Testing Reference (points to relevant tests)
     - BEFORE IMPLEMENTATION checklist (RED phase)
     - IMPLEMENTATION section (GREEN phase)
     - REFACTOR section
     - VERIFICATION checklist
     - QUALITY CHECKS checklist
     - COMPLETION checklist
     - Exit Criteria

**Implementation Approach**:

### Phase 1: Preparation and Planning

#### 1.1 Review and Analysis

- [ ] Read `docs/dev/MVP-Implementation-Task-Plan.md` completely (all 12 phases)
- [ ] For each phase, identify:
- [ ] All implementation steps and sub-steps
- [ ] Components/features being built
- [ ] API endpoints being created
- [ ] Database operations involved
- [ ] UI components requiring tests
- [ ] Integration points between systems
- [ ] Security-critical functionality

#### 1.2 Testing Strategy Decision Matrix

For each component/feature identified, determine test types needed:

**Decision Table:**

| Component Type          | Unit Test                | Integration Test  | E2E Test          | Storybook            |
| ----------------------- | ------------------------ | ----------------- | ----------------- | -------------------- |
| Utility Function        | ✅ Primary               | ❌ No             | ❌ No             | ❌ No                |
| Validation Schema (Zod) | ✅ Primary               | ❌ No             | ❌ No             | ❌ No                |
| API Endpoint            | ❌ No                    | ✅ Primary        | ⭐ Critical Paths | ❌ No                |
| Database Query          | ❌ No                    | ✅ Primary        | ❌ No             | ❌ No                |
| UI Component            | ✅ Primary               | ❌ No             | ❌ No             | ✅ Yes (after tests) |
| Svelte Store            | ✅ Primary               | ❌ No             | ❌ No             | ❌ No                |
| Complete User Flow      | ❌ No                    | ❌ No             | ✅ Primary        | ❌ No                |
| Service Class           | ✅ Primary (mocked deps) | ⭐ With real deps | ❌ No             | ❌ No                |

#### 1.3 Template Preparation

- [ ] Review the "Enhanced Testing Requirements Template" (see section below)
- [ ] Review the "Enhanced Step Pattern Template" (see section below)
- [ ] Understand how to apply templates consistently

### Phase 2: Phase-by-Phase Enhancement

For EACH phase (2 through 12), follow this systematic approach:

#### Step 2.1: Analyze Phase Implementation Steps

- [ ] Read the phase's "Detailed Implementation Steps" section completely
- [ ] Create a spreadsheet or markdown file listing:
  - [ ] Every main step (e.g., 2.1, 2.2, 2.3)
  - [ ] Every sub-step (e.g., 2.2.1, 2.2.2, 2.2.3)
  - [ ] Every task item under each sub-step
- [ ] For each sub-step, identify:
  - [ ] What is being built (API routes, UI components, utilities, etc.)
  - [ ] What tests are needed (unit, integration, e2e)
  - [ ] Estimated number of test cases
  - [ ] Whether database is involved (and testing strategy)
  - [ ] Whether UI components need Storybook stories

#### Step 2.2: Create Phase-Level Testing Requirements

- [ ] Replace the generic "Testing Requirements" section with enhanced version
- [ ] Use the "Enhanced Testing Requirements Template" (below)
- [ ] Fill in all sections:
  - [ ] **Minimum Viable Tests (MVT) - Tier 1**:
    - [ ] List all unit test files with purposes
    - [ ] List all integration test files with purposes
    - [ ] List all E2E test files with purposes
    - [ ] For each file, enumerate specific test cases (at least 3-5 examples)
    - [ ] Estimate total test cases
  - [ ] **Additional Tests - Tier 2**:
    - [ ] List edge case tests
    - [ ] List error handling tests
    - [ ] List performance tests (if applicable)
  - [ ] **Documentation**:
    - [ ] List Storybook stories (if UI phase)
  - [ ] **Test Summary**:
    - [ ] Total MVT test cases
    - [ ] Total Nice-to-Have test cases
    - [ ] Total test files by type
  - [ ] **Database Testing Strategy** (if applicable):
    - [ ] Specify: transaction rollback OR full reset
    - [ ] List helper functions needed
    - [ ] Specify test data seeding approach
  - [ ] **Step Integration Instructions**:
    - [ ] Copy from template - instructs how to update individual steps

#### Step 2.3: Transform Each Sub-Step with TDD Workflow

For EVERY sub-step in the phase (e.g., 2.2.2, 2.3.1, 2.4.2):

- [ ] Identify which tests from Testing Requirements apply to this specific sub-step
- [ ] Count total tests for this sub-step
- [ ] Transform the sub-step using "Enhanced Step Pattern Template" (below)
- [ ] Add all required sections:
  - [ ] **Testing Reference** line
  - [ ] **Applicable Tests** list
  - [ ] **BEFORE IMPLEMENTATION** checklist (RED phase)
  - [ ] **IMPLEMENTATION** section (GREEN phase)
  - [ ] **REFACTOR** section
  - [ ] **VERIFICATION** checklist
  - [ ] **QUALITY CHECKS** checklist
  - [ ] **COMPLETION** checklist
  - [ ] **Exit Criteria** list

#### Step 2.4: Quality Assurance for Phase

- [ ] Use "TDD Verification Checklist" (see section below)
- [ ] Verify all Testing Requirements sections are complete
- [ ] Verify all sub-steps have been transformed
- [ ] Verify consistency with templates
- [ ] Verify Git workflow is properly integrated
- [ ] Check that dependencies are clear (previous step complete before next)

#### Step 2.5: Document and Commit Phase Enhancement

- [ ] Create Git branch: `git checkout -b enhance-phase-X-testing-requirements`
- [ ] Make all changes to `docs/dev/MVP-Implementation-Task-Plan.md`
- [ ] Commit: `git commit -m "docs(phase-X): enhance testing requirements and TDD integration"`
- [ ] Push branch for review
- [ ] After approval, merge: `git merge --no-ff enhance-phase-X-testing-requirements`

---

### Phase 3: Final Review and Documentation

#### 3.1 Comprehensive Review

- [ ] Read enhanced MVP Task Plan completely
- [ ] Verify all 11 phases (2-12) have been enhanced
- [ ] Verify consistency across all phases
- [ ] Verify all templates were applied correctly
- [ ] Check for any missing or unclear sections

#### 3.2 Create Example Walkthrough

- [ ] Select one complete phase (recommend Phase 2) as reference example
- [ ] Create document: `docs/dev/tdd-step-pattern-example-walkthrough.md`
- [ ] Show complete before/after for one phase
- [ ] Include commentary explaining decisions made

#### 3.3 Update Related Documentation

- [ ] Update `CLAUDE.md` to reference enhanced MVP Task Plan
- [ ] Archive old proposal documents
- [ ] Update any references in other docs

### Templates

### Template 1: Enhanced Testing Requirements Section

Use this template to replace the generic "Testing Requirements" section in each phase:

````markdown
### Testing Requirements

**Testing Philosophy**: All tests MUST be written BEFORE implementation (TDD). Each implementation step below has been enhanced with explicit test references and verification requirements.

**Database Testing Strategy**: [Choose one]

- **Transaction Rollback**: Tests use database transactions and rollback after each test (faster, preferred for unit-like integration tests)
- **Full Database Reset**: Tests reset entire database to clean state before each test (slower, required for true integration tests with complex dependencies)

---

#### Minimum Viable Tests (MVT) - Tier 1 - MUST CREATE FIRST

**Unit Tests** (`tests/unit/`):

- [ ] **`path/to/test-file-1.test.ts`** - Purpose: [Describe what this test file covers]
  - [ ] Test case 1: [Specific test description] (MVT)
  - [ ] Test case 2: [Specific test description] (MVT)
  - [ ] Test case 3: [Specific test description] (MVT)
  - [ ] Test case 4: [Specific test description] (MVT)
  - [ ] Test case 5: [Specific test description] (MVT)
  - **Estimated**: ~X test cases total

- [ ] **`path/to/test-file-2.test.ts`** - Purpose: [Describe what this test file covers]
  - [ ] Test case 1: [Specific test description] (MVT)
  - [ ] Test case 2: [Specific test description] (MVT)
  - [ ] Test case 3: [Specific test description] (MVT)
  - **Estimated**: ~X test cases total

**Integration Tests** (`tests/integration/`):

- [ ] **`path/to/test-file-1.integration.test.ts`** - Purpose: [Describe what this test file covers]
  - [ ] Test case 1: [Specific test description] (MVT)
  - [ ] Test case 2: [Specific test description] (MVT)
  - [ ] Test case 3: [Specific test description] (MVT)
  - [ ] Test case 4: [Specific test description] (MVT)
  - **Database Strategy**: Transaction rollback / Full reset
  - **Estimated**: ~X test cases total

- [ ] **`path/to/test-file-2.integration.test.ts`** - Purpose: [Describe what this test file covers]
  - [ ] Test case 1: [Specific test description] (MVT)
  - [ ] Test case 2: [Specific test description] (MVT)
  - **Database Strategy**: Transaction rollback / Full reset
  - **Estimated**: ~X test cases total

**E2E Tests** (`tests/e2e/`):

- [ ] **`test-file-1.spec.ts`** - Purpose: [Describe critical user flow]
  - [ ] User flow 1: [Complete workflow description] (MVT)
  - [ ] User flow 2: [Complete workflow description] (MVT)
  - **Estimated**: ~X complete flows

- [ ] **`test-file-2.spec.ts`** - Purpose: [Describe critical user flow]
  - [ ] User flow 1: [Complete workflow description] (MVT)
  - **Estimated**: ~X complete flows

---

#### Additional Tests - Tier 2 - ADD AFTER MVT PASSES

**Unit Tests** (Edge Cases):

- [ ] **`path/to/test-file-edge-cases.test.ts`** - Purpose: [Edge case scenarios]
  - [ ] Test case: [Null/empty values] (Nice-to-Have)
  - [ ] Test case: [Boundary values] (Nice-to-Have)
  - [ ] Test case: [Invalid inputs] (Nice-to-Have)
  - **Estimated**: ~X test cases

**Integration Tests** (Error Handling):

- [ ] **`path/to/error-handling.integration.test.ts`** - Purpose: [Error scenarios]
  - [ ] Test case: [Database connection failure] (Nice-to-Have)
  - [ ] Test case: [Network timeout] (Nice-to-Have)
  - [ ] Test case: [Validation errors] (Nice-to-Have)
  - **Estimated**: ~X test cases

**E2E Tests** (Secondary Flows):

- [ ] **`secondary-flows.spec.ts`** - Purpose: [Non-critical user paths]
  - [ ] User flow: [Alternative workflow] (Nice-to-Have)
  - **Estimated**: ~X flows

---

#### Documentation - CREATE AFTER TESTS PASS

**Storybook Stories** (`src/lib/components/`) - [If UI components in this phase]:

- [ ] **`component-name.stories.ts`**:
  - [ ] Story: Default variant
  - [ ] Story: All size variants (sm, md, lg, xl)
  - [ ] Story: Loading state
  - [ ] Story: Error state
  - [ ] Story: Disabled state
  - [ ] Story: With different prop combinations
  - [ ] Story: Dark mode variant

- [ ] **`another-component.stories.ts`**:
  - [ ] Story: [Similar variants as above]

---

#### Test Summary

- **Total MVT Test Cases**: ~X unit + ~Y integration + ~Z e2e = **~N total**
- **Total Nice-to-Have Test Cases**: ~X
- **Total Test Files**: X unit + Y integration + Z e2e = **N files**
- **Storybook Stories**: X components (created after tests pass)

---

#### Database Testing Helpers

[If phase involves database operations, specify required helpers]

**Required Helper Functions** (`tests/helpers/db-helpers.ts`):

```typescript
// Example helpers for this phase
export async function setupPhaseXTestData() {
	// Seed test data specific to this phase
}

export async function cleanupPhaseXTestData() {
	// Clean up test data specific to this phase
}

export async function createTestUser() {
	// Create a test user for authentication tests
}
```

**Test Database Configuration**:

- Database: `savvy_next_test` (port 54322)
- Connection string: Set in `.env.test`
- Migrations: Applied via `scripts/setup-test-db.ps1`

---

#### Step Integration Instructions

**CRITICAL**: After creating this Testing Requirements section, you MUST update each implementation step in this phase to reference these tests.

**For EACH implementation sub-step** (e.g., X.Y.1, X.Y.2, X.Y.3):

1. Identify which test files from above apply to that specific sub-step
2. Count total tests applicable to that sub-step
3. Transform the sub-step using the "Enhanced Step Pattern Template" (see below)
4. Add all required sections:
   - Testing Reference (points to specific tests above)
   - Applicable Tests (list with counts)
   - BEFORE IMPLEMENTATION checklist (RED phase)
   - IMPLEMENTATION section (GREEN phase tasks)
   - REFACTOR section (code improvement)
   - VERIFICATION checklist (tests must pass)
   - QUALITY CHECKS checklist (diagnostics/linting)
   - COMPLETION checklist (merge and mark done)
   - Exit Criteria (conditions to proceed)

5. Ensure step cannot be marked complete until:
   - All tests pass
   - Zero diagnostic errors
   - Zero ESLint warnings
   - Code formatted with Prettier
   - Git workflow completed

**See "Enhanced Step Pattern Template" below for complete pattern to apply.**

---
````

**Instructions for Using This Template**:

1. Copy the entire template above
2. Replace the "Testing Requirements" section in the phase
3. Fill in all bracketed placeholders: `[Describe...]`, `~X`, etc.
4. For each test file:
   - Provide actual file path (e.g., `tests/unit/lib/auth/password-validator.test.ts`)
   - Write specific test case descriptions (not generic)
   - Estimate test case counts based on feature complexity
5. Choose database strategy based on phase needs
6. Remove Storybook section if phase has no UI components
7. Update test summary with accurate totals
8. Add any phase-specific database helpers needed

---

### Template 2: Enhanced Step Pattern

Use this template to transform EACH sub-step in the implementation steps:

```markdown
**X.Y.Z [Sub-Step Name]**

**Testing Reference**: See Phase X Testing Requirements - [Specific Section Name]

**Applicable Tests**:

- `test-file-1.test.ts` (N test cases)
- `test-file-2.integration.test.ts` (M test cases)
- `test-file-3.spec.ts` (P flows)
- **Total**: ~X tests for this step

---

**BEFORE IMPLEMENTATION** (RED Phase):

- [ ] **Create test branch**: `git checkout -b phase-X.Y.Z-tests`
- [ ] **Empty commit**: `git commit --allow-empty -m "step(X.Y.Z-tests): start - Test implementation for [Step Name]"`
- [ ] **Write all unit tests**:
  - [ ] Create `test-file-1.test.ts`
  - [ ] Implement all X test cases listed in Testing Requirements
  - [ ] Verify tests FAIL (RED phase proves tests work)
- [ ] **Write all integration tests**:
  - [ ] Create `test-file-2.integration.test.ts`
  - [ ] Implement all X test cases with database strategy from Testing Requirements
  - [ ] Set up test database helpers if needed
  - [ ] Verify tests FAIL (RED phase)
- [ ] **Write all E2E tests** (if applicable):
  - [ ] Create `test-file-3.spec.ts`
  - [ ] Implement all X user flows
  - [ ] Verify tests FAIL (RED phase)
- [ ] **Commit failing tests**: `git add tests/ && git commit -m "test(X.Y.Z): add failing tests for [feature]"`
- [ ] **Verify RED phase**: Run tests and confirm ALL new tests FAIL
  - [ ] Unit: `pnpm test:unit [pattern] --run`
  - [ ] Integration: `pnpm test:integration [pattern] --run`
  - [ ] E2E: `pnpm test:e2e [pattern]`
- [ ] **Merge tests to main**: `git checkout main && git merge --no-ff phase-X.Y.Z-tests -m "merge: tests for step X.Y.Z"`
- [ ] **Update Testing Requirements checkboxes**: Mark all test files as [ ] (not yet passing)

---

**IMPLEMENTATION** (GREEN Phase):

- [ ] **Create implementation branch**: `git checkout -b phase-X.Y.Z-[kebab-case-description]`
- [ ] **Empty commit**: `git commit --allow-empty -m "step(X.Y.Z): start - [Step Description]"`
- [ ] **Implement minimal code to pass tests**:
  - [ ] [Original task item 1 from sub-step]
  - [ ] [Original task item 2 from sub-step]
  - [ ] [Original task item 3 from sub-step]
  - [ ] [Continue with all original task items...]
- [ ] **Incremental commits**: After each logical unit of work:
  - [ ] Commit: `git add -A && git commit -m "feat(X.Y.Z): implement [specific feature]"`
  - [ ] Run relevant tests: `pnpm test:unit [pattern]` or `pnpm test:integration [pattern]`
  - [ ] Verify tests are passing incrementally
- [ ] **Verify GREEN phase**: All tests for this step pass
  - [ ] Unit tests: `pnpm test:unit [pattern] --run` → All pass ✅
  - [ ] Integration tests: `pnpm test:integration [pattern] --run` → All pass ✅
  - [ ] E2E tests: `pnpm test:e2e [pattern]` → All pass ✅

---

**REFACTOR** (REFACTOR Phase):

- [ ] **Improve code quality while keeping tests green**:
  - [ ] Extract common patterns into utilities
  - [ ] Improve naming and clarity
  - [ ] Add comprehensive comments and documentation
  - [ ] Optimize database queries (if applicable)
  - [ ] Improve error handling
  - [ ] Add proper TypeScript types (remove any `any` types)
  - [ ] Add logging with universal logger (replace console.log)
- [ ] **Incremental refactor commits**: After each improvement:
  - [ ] Commit: `git add -A && git commit -m "refactor(X.Y.Z): improve [aspect]"`
  - [ ] Run tests after EACH refactor: `pnpm test:unit [pattern]`
  - [ ] Tests MUST stay green throughout refactoring ✅
- [ ] **Verify tests still pass**: `pnpm test:unit [pattern] && pnpm test:integration [pattern]`

---

**VERIFICATION**:

- [ ] **All X tests pass for this step**:
  - [ ] Unit tests: `pnpm test:unit [pattern] --run` → X/X passing ✅
  - [ ] Integration tests: `pnpm test:integration [pattern] --run` → X/X passing ✅
  - [ ] E2E tests (if applicable): `pnpm test:e2e [pattern]` → X/X passing ✅
- [ ] **Manual testing** (if applicable):
  - [ ] Test feature manually in browser
  - [ ] Verify UI looks correct
  - [ ] Verify API responses are correct
  - [ ] Check database state after operations
- [ ] **Feature works as expected**: [List specific verification steps]

---

**QUALITY CHECKS**:

- [ ] **Run diagnostics**: `get_diagnostics_code()` → **Zero errors** ✅
  - [ ] If errors found: Fix immediately using `apply_diff`
  - [ ] Re-check: `get_diagnostics_code()` until zero errors
- [ ] **Run linter**: `pnpm lint` → **Zero warnings** ✅
  - [ ] If warnings found: Fix immediately
  - [ ] Re-check: `pnpm lint` until zero warnings
- [ ] **Run formatter**: `pnpm format` → **All files formatted** ✅
  - [ ] Commit formatting: `git add -A && git commit -m "style(X.Y.Z): apply prettier formatting"`
- [ ] **Check test coverage**: `pnpm test:coverage` → **≥80% for new code** ✅
  - [ ] Identify uncovered lines
  - [ ] Add tests for critical uncovered code
  - [ ] Re-check coverage
- [ ] **Run full test suite**: `pnpm test` → **All tests pass** ✅

---

**COMPLETION**:

- [ ] **Final verification before merge**:
  - [ ] All tests passing: `pnpm test`
  - [ ] Zero diagnostic errors: `get_diagnostics_code()`
  - [ ] Zero linting warnings: `pnpm lint`
  - [ ] Code formatted: `pnpm format`
  - [ ] Git status clean or all changes committed
- [ ] **Merge to main**:
  - [ ] `git checkout main`
  - [ ] `git merge --no-ff phase-X.Y.Z-[description] -m "merge: complete step X.Y.Z - [Step Name]"`
- [ ] **Update task plan checkboxes**:
  - [ ] Update this sub-step checkbox: `- [x] **X.Y.Z [Sub-Step Name]**`
  - [ ] Update Testing Requirements checkboxes: Mark all test files as [x]
  - [ ] Update main step checkbox if all sub-steps complete: `- [x] **X.Y Complete**`
- [ ] **Ready to proceed**: Verify all completion criteria met before starting next step

---

**Exit Criteria** (Must meet ALL before proceeding to next step):

- ✅ All X tests written and passing (RED → GREEN cycle complete)
- ✅ Code refactored and optimized (REFACTOR phase complete)
- ✅ Zero TypeScript errors (`get_diagnostics_code()`)
- ✅ Zero ESLint warnings (`pnpm lint`)
- ✅ Code properly formatted (`pnpm format`)
- ✅ Test coverage ≥80% for new code
- ✅ Feature fully functional and manually verified
- ✅ Git workflow complete (merged to main)
- ✅ Task plan checkboxes updated
- ✅ Testing Requirements checkboxes updated
- ✅ No blockers or known issues

---
```

**Instructions for Using This Template**:

1. Copy the entire template above
2. Replace `X.Y.Z` with actual step number (e.g., 2.2.2)
3. Replace `[Sub-Step Name]` with actual step name
4. Update "Testing Reference" to point to specific section in Testing Requirements
5. List applicable tests from Testing Requirements with accurate counts
6. Under IMPLEMENTATION, replace placeholder task items with original task items from the sub-step
7. Update all `[pattern]` placeholders with actual test file patterns (e.g., `auth/login`)
8. Update verification steps with feature-specific checks
9. Keep all checkboxes - they enable progress tracking
10. Do NOT remove any sections - all are required for TDD workflow

---

### Phase-by-Phase Execution Plan

#### Phases to Update

- [x] **Phase 1**: Foundation & Infrastructure Setup
  - **Skip**: Already complete and focused on setup, not feature development
  - No testing requirements needed

- [ ] **Phase 2**: Authentication & User Management
  - **Priority**: HIGH - Use as reference template for other phases
  - **Complexity**: High (security-critical, multiple authentication flows)
  - **Test Types**: Unit (utilities, validation), Integration (API, database), E2E (login flows)
  - **Database Testing**: Full reset (authentication state must be pristine)
  - **Main Steps**: 2.1 (DB Schema), 2.2 (Better-Auth Config), 2.3 (UI), 2.4 (Security), 2.5 (Profile)
  - **Sub-steps to Transform**: ~12-15 sub-steps

- [ ] **Phase 3**: Core Database Schema & Data Layer
  - **Priority**: HIGH - Foundation for all data operations
  - **Complexity**: High (database design, migrations, queries)
  - **Test Types**: Integration (database operations, migrations), Unit (query builders)
  - **Database Testing**: Both transaction rollback (unit-like) and full reset (migrations)
  - **Main Steps**: 3.1 (Core Tables), 3.2 (Relationships), 3.3 (Repository Pattern)
  - **Sub-steps to Transform**: ~10-12 sub-steps

- [ ] **Phase 4**: File Management & Storage System
  - **Priority**: MEDIUM - Supporting infrastructure
  - **Complexity**: Medium (file uploads, storage, CDN)
  - **Test Types**: Integration (file operations, storage), Unit (file utilities)
  - **Database Testing**: Transaction rollback (file metadata)
  - **Main Steps**: 4.1 (Storage Config), 4.2 (Upload API), 4.3 (File Manager)
  - **Sub-steps to Transform**: ~8-10 sub-steps

- [ ] **Phase 5**: Learning Management Core - Courses
  - **Priority**: HIGH - Core business feature
  - **Complexity**: High (CRUD, UI, API, permissions)
  - **Test Types**: Unit (components), Integration (API, database), E2E (course flows), Storybook (UI)
  - **Database Testing**: Transaction rollback preferred
  - **Main Steps**: 5.1 (Course API), 5.2 (Course UI), 5.3 (Course Management)
  - **Sub-steps to Transform**: ~12-15 sub-steps
  - **Storybook**: Yes (course cards, forms, list views)

- [ ] **Phase 6**: Learning Management Core - Lessons
  - **Priority**: HIGH - Core business feature
  - **Complexity**: High (content types, progress tracking, UI)
  - **Test Types**: Unit (components, utilities), Integration (API), E2E (lesson flows), Storybook (UI)
  - **Database Testing**: Transaction rollback preferred
  - **Main Steps**: 6.1 (Lesson API), 6.2 (Lesson UI), 6.3 (Progress Tracking)
  - **Sub-steps to Transform**: ~12-15 sub-steps
  - **Storybook**: Yes (lesson viewer, content types, progress indicators)

- [ ] **Phase 7**: Quiz & Assessment System
  - **Priority**: HIGH - Complex business logic
  - **Complexity**: Very High (quiz engine, grading, results)
  - **Test Types**: Unit (quiz logic, grading), Integration (API, database), E2E (taking quiz)
  - **Database Testing**: Transaction rollback for most, full reset for result calculations
  - **Main Steps**: 7.1 (Quiz Engine), 7.2 (Quiz UI), 7.3 (Results), 7.4 (Grading)
  - **Sub-steps to Transform**: ~15-18 sub-steps
  - **Storybook**: Yes (quiz components, question types)

- [ ] **Phase 8**: Assignment & Enrollment System
  - **Priority**: MEDIUM-HIGH - Business feature
  - **Complexity**: Medium-High (workflows, state management)
  - **Test Types**: Unit (state logic), Integration (API, database), E2E (enrollment flows)
  - **Database Testing**: Transaction rollback preferred
  - **Main Steps**: 8.1 (Enrollment API), 8.2 (Assignment API), 8.3 (UI)
  - **Sub-steps to Transform**: ~10-12 sub-steps

- [ ] **Phase 9**: Reporting & Analytics
  - **Priority**: MEDIUM - Business intelligence
  - **Complexity**: Medium (aggregations, charts, exports)
  - **Test Types**: Unit (calculations), Integration (reports, queries), E2E (viewing reports)
  - **Database Testing**: Full reset (need known data for consistent reports)
  - **Main Steps**: 9.1 (Report Engine), 9.2 (Dashboards), 9.3 (Exports)
  - **Sub-steps to Transform**: ~10-12 sub-steps
  - **Storybook**: Yes (charts, dashboards)

- [ ] **Phase 10**: Notifications & Email System
  - **Priority**: MEDIUM - Supporting feature
  - **Complexity**: Medium (email templates, delivery, tracking)
  - **Test Types**: Unit (templating), Integration (email service, database)
  - **Database Testing**: Transaction rollback
  - **Main Steps**: 10.1 (Email Service), 10.2 (Notifications), 10.3 (Templates)
  - **Sub-steps to Transform**: ~8-10 sub-steps

- [ ] **Phase 11**: Security & Performance
  - **Priority**: HIGH - Critical for production
  - **Complexity**: High (security testing, performance optimization)
  - **Test Types**: Security tests, Performance tests, Load tests
  - **Database Testing**: N/A (mostly security and performance)
  - **Main Steps**: 11.1 (Security Hardening), 11.2 (Performance), 11.3 (Monitoring)
  - **Sub-steps to Transform**: ~8-10 sub-steps

- [ ] **Phase 12**: Final Integration & Testing
  - **Priority**: HIGH - Pre-production validation
  - **Complexity**: High (comprehensive E2E, integration testing)
  - **Test Types**: Comprehensive E2E, Integration smoke tests
  - **Database Testing**: Full reset (testing complete system)
  - **Main Steps**: 12.1 (Integration Testing), 12.2 (E2E Suites), 12.3 (Documentation)
  - **Sub-steps to Transform**: ~10-12 sub-steps

---

### TDD Verification Checklist

#### After Enhancing Each Phase

Before moving to the next phase, verify:

##### Phase-Level Verification

- [ ] **Testing Requirements Section Enhanced**:
  - [ ] Section uses "Enhanced Testing Requirements Template"
  - [ ] All test files listed with full paths
  - [ ] All test cases enumerated (at least 3-5 examples per file)
  - [ ] MVT (Tier 1) tests clearly identified
  - [ ] Nice-to-Have (Tier 2/3) tests clearly identified
  - [ ] Database testing strategy specified (if applicable)
  - [ ] Storybook guidance included (if UI components)
  - [ ] Test summary completed with accurate counts
  - [ ] Effort estimation provided
  - [ ] Step integration instructions included

##### Step-Level Verification

- [ ] **All Sub-Steps Transformed**:
  - [ ] Every sub-step (X.Y.Z) uses "Enhanced Step Pattern Template"
  - [ ] "Testing Reference" line points to Testing Requirements
  - [ ] "Applicable Tests" lists specific test files with counts
  - [ ] "BEFORE IMPLEMENTATION" checklist present (RED phase)
  - [ ] "IMPLEMENTATION" section has original task items (GREEN phase)
  - [ ] "REFACTOR" section included
  - [ ] "VERIFICATION" checklist present
  - [ ] "QUALITY CHECKS" checklist present
  - [ ] "COMPLETION" checklist present
  - [ ] "Exit Criteria" clearly defined

##### Workflow Verification

- [ ] **Dependencies Clear**:
  - [ ] Each step requires tests BEFORE implementation
  - [ ] Cannot mark step complete without tests passing
  - [ ] Quality gates at every step (diagnostics, linting)
  - [ ] Previous step must be complete before next
  - [ ] Git workflow properly integrated

##### Consistency Verification

- [ ] **Pattern Matches Reference**:
  - [ ] Format consistent with Phase 2 (reference template)
  - [ ] All required sections present
  - [ ] Checkboxes enable tracking
  - [ ] Git commands use correct format
  - [ ] Test commands use correct patterns

##### Quality Verification

- [ ] **Comprehensive and Clear**:
  - [ ] Instructions are actionable
  - [ ] No ambiguity in requirements
  - [ ] Test counts are reasonable estimates
  - [ ] Effort estimates are realistic
  - [ ] Future Claude can follow without confusion

---

### Success Criteria

**Phase-Level Success Criteria**:

- [ ] All 11 phases (2-12) have enhanced Testing Requirements sections
- [ ] Each Testing Requirements section lists specific test files with paths
- [ ] Each test file lists specific test cases (minimum 3-5 examples)
- [ ] MVT (Tier 1) tests clearly identified for prioritization
- [ ] Nice-to-Have (Tier 2/3) tests clearly identified
- [ ] Database testing approach specified where applicable
- [ ] Storybook guidance included for UI components
- [ ] Test effort estimated for each phase
- [ ] Template used consistently across all phases
- [ ] Step integration instructions included in every phase

**Step-Level Success Criteria**:

- [ ] Every implementation sub-step (X.Y.Z) references specific tests from Testing Requirements
- [ ] Every sub-step includes "Testing Reference" line
- [ ] Every sub-step includes "Applicable Tests" list with counts
- [ ] Every sub-step includes "BEFORE IMPLEMENTATION" checklist (RED phase)
- [ ] Every sub-step includes "IMPLEMENTATION" section (GREEN phase)
- [ ] Every sub-step includes "REFACTOR" section
- [ ] Every sub-step includes "VERIFICATION" checklist
- [ ] Every sub-step includes "QUALITY CHECKS" checklist
- [ ] Every sub-step includes "COMPLETION" checklist
- [ ] Every sub-step includes "Exit Criteria"
- [ ] Step completion dependencies clear (cannot proceed until tests pass)
- [ ] TDD workflow enforced at step granularity

**Quality Success Criteria**:

- [ ] Consistency across all phases (same pattern, same level of detail)
- [ ] No ambiguous or unclear instructions
- [ ] All templates applied correctly
- [ ] Git workflow integrated at step level
- [ ] Test commands use correct patterns
- [ ] Database testing strategies are appropriate
- [ ] Effort estimates are realistic

**Documentation Success Criteria**:

- [ ] Example walkthrough document created (`tdd-step-pattern-example-walkthrough.md`)
- [ ] CLAUDE.md updated to reference enhanced MVP Task Plan
- [ ] Proposal document archived
- [ ] Related documentation updated

**Project Success Criteria**:

- [ ] MVP Task Plan is single source of truth for TDD implementation
- [ ] Future Claude instances can follow plan without additional guidance
- [ ] Plan enforces TDD discipline at granular level
- [ ] Plan prevents skipping tests or quality checks
- [ ] Plan enables accurate progress tracking
- [ ] Plan facilitates recovery after interruptions

---

**Reference Documents**:

- `docs/dev/MVP-Implementation-Task-Plan.md` - Document to enhance
- `docs/dev/architecture/17_Testing-Strategy.md` - Testing patterns
- `docs/test-database-strategy.md` - Database testing approaches
- `CLAUDE.md` - This document contains all templates, examples, and TDD workflow guidance

---

### Example: Phase 2 Sub-Step 2.2.2 (Complete)

Here is a COMPLETE example showing Sub-Step 2.2.2 fully transformed:

```markdown
**2.2.2 Create Authentication API Routes**

**Testing Reference**: See Phase 2 Testing Requirements - "Integration Tests (tests/integration/auth/)"

**Applicable Tests**:

- `tests/integration/auth/register.integration.test.ts` (9 test cases)
- `tests/integration/auth/login.integration.test.ts` (11 test cases)
- `tests/integration/auth/logout.integration.test.ts` (5 test cases)
- `tests/integration/auth/session.integration.test.ts` (4 test cases)
- `tests/integration/auth/refresh.integration.test.ts` (6 test cases)
- `tests/integration/auth/password-reset.integration.test.ts` (14 test cases)
- **Total**: 49 integration tests

---

**BEFORE IMPLEMENTATION** (RED Phase):

- [ ] **Create test branch**: `git checkout -b phase-2.2.2-tests`
- [ ] **Empty commit**: `git commit --allow-empty -m "step(2.2.2-tests): start - Integration tests for auth API routes"`
- [ ] **Write all integration tests**:
  - [ ] Create `tests/integration/auth/register.integration.test.ts`:
    - [ ] Test: Successful registration with valid data
    - [ ] Test: Registration fails with duplicate email
    - [ ] Test: Registration fails with weak password
    - [ ] Test: Registration fails with missing required fields
    - [ ] Test: Registration fails with invalid email format
    - [ ] Test: Registration creates user in database
    - [ ] Test: Registration creates default profile
    - [ ] Test: Registration returns proper session token
    - [ ] Test: Registration logs authentication event
  - [ ] Create `tests/integration/auth/login.integration.test.ts`:
    - [ ] Test: Successful login with email/password
    - [ ] Test: Successful login with employee_id/last_name
    - [ ] Test: Login fails with wrong password
    - [ ] Test: Login fails with non-existent user
    - [ ] Test: Login increments failed_login_attempts on failure
    - [ ] Test: Login locks account after 10 failed attempts
    - [ ] Test: Login respects rate limiting (3, 5, 10 thresholds)
    - [ ] Test: Login updates last_login_at timestamp
    - [ ] Test: Login creates session in database
    - [ ] Test: Login returns proper session cookie
    - [ ] Test: Login logs authentication event
  - [ ] Create `tests/integration/auth/logout.integration.test.ts`:
    - [ ] Test: Successful logout invalidates session
    - [ ] Test: Logout removes session from database
    - [ ] Test: Logout clears session cookie
    - [ ] Test: Logout fails with invalid session
    - [ ] Test: Logout logs authentication event
  - [ ] Create `tests/integration/auth/session.integration.test.ts`:
    - [ ] Test: Valid session returns user data
    - [ ] Test: Expired session returns 401
    - [ ] Test: Invalid session token returns 401
    - [ ] Test: Session validation updates last_activity_at
  - [ ] Create `tests/integration/auth/refresh.integration.test.ts`:
    - [ ] Test: Successful refresh extends session
    - [ ] Test: Refresh creates new session token
    - [ ] Test: Refresh invalidates old token
    - [ ] Test: Refresh fails with expired session
    - [ ] Test: Refresh fails with invalid token
    - [ ] Test: Refresh logs authentication event
  - [ ] Create `tests/integration/auth/password-reset.integration.test.ts`:
    - [ ] Test: Forgot password creates reset token
    - [ ] Test: Forgot password sends email (mocked)
    - [ ] Test: Forgot password always returns success (email enumeration prevention)
    - [ ] Test: Forgot password rate limited
    - [ ] Test: Reset password with valid token succeeds
    - [ ] Test: Reset password invalidates token after use
    - [ ] Test: Reset password fails with expired token
    - [ ] Test: Reset password fails with invalid token
    - [ ] Test: Reset password fails with weak password
    - [ ] Test: Reset password updates password_hash
    - [ ] Test: Reset password logs authentication event
    - [ ] Test: Reset password allows login with new password
    - [ ] Test: Reset password prevents reuse of old token
    - [ ] Test: Reset password clears failed_login_attempts
- [ ] **Commit failing tests**: `git add tests/integration/auth/ && git commit -m "test(2.2.2): add 49 failing integration tests for auth API routes"`
- [ ] **Verify RED phase**: Run tests and confirm ALL 49 new tests FAIL
  - [ ] `pnpm test:integration auth --run`
  - [ ] Verify output shows 49 failing tests
- [ ] **Merge tests to main**: `git checkout main && git merge --no-ff phase-2.2.2-tests -m "merge: integration tests for auth API routes (step 2.2.2)"`
- [ ] **Update Testing Requirements checkboxes**: Mark all 6 integration test files as [ ] (not yet passing)

---

**IMPLEMENTATION** (GREEN Phase):

- [ ] **Create implementation branch**: `git checkout -b phase-2.2.2-auth-api-routes`
- [ ] **Empty commit**: `git commit --allow-empty -m "step(2.2.2): start - Create authentication API routes"`
- [ ] **Implement API routes**:
  - [ ] Create `/api/auth/register/+server.ts`:
    - [ ] Implement POST handler
    - [ ] Add Zod validation schema
    - [ ] Call Better-Auth API with proper error handling
    - [ ] Return standardized API response
    - [ ] Add comprehensive logging
    - [ ] Commit: `git add src/routes/api/auth/register && git commit -m "feat(2.2.2): implement user registration endpoint"`
  - [ ] Create `/api/auth/login/+server.ts`:
    - [ ] Implement POST handler
    - [ ] Support both email/password and employee_id/last_name
    - [ ] Add rate limiting logic
    - [ ] Track failed login attempts
    - [ ] Implement account locking (10 attempts)
    - [ ] Update last_login_at timestamp
    - [ ] Return session cookie
    - [ ] Add comprehensive logging
    - [ ] Commit: `git add src/routes/api/auth/login && git commit -m "feat(2.2.2): implement login endpoint with rate limiting"`
  - [ ] Create `/api/auth/logout/+server.ts`:
    - [ ] Implement POST handler
    - [ ] Invalidate session in database
    - [ ] Clear session cookie
    - [ ] Add logging
    - [ ] Commit: `git add src/routes/api/auth/logout && git commit -m "feat(2.2.2): implement logout endpoint"`
  - [ ] Create `/api/auth/session/+server.ts`:
    - [ ] Implement GET handler
    - [ ] Validate session token
    - [ ] Return user data
    - [ ] Update last_activity_at
    - [ ] Commit: `git add src/routes/api/auth/session && git commit -m "feat(2.2.2): implement session validation endpoint"`
  - [ ] Create `/api/auth/refresh/+server.ts`:
    - [ ] Implement POST handler
    - [ ] Extend session expiration
    - [ ] Rotate session token
    - [ ] Invalidate old token
    - [ ] Commit: `git add src/routes/api/auth/refresh && git commit -m "feat(2.2.2): implement session refresh endpoint"`
  - [ ] Create `/api/auth/forgot-password/+server.ts`:
    - [ ] Implement POST handler
    - [ ] Generate secure reset token
    - [ ] Store token in database
    - [ ] Send email (or log in dev mode)
    - [ ] Always return success (email enumeration prevention)
    - [ ] Add rate limiting
    - [ ] Commit: `git add src/routes/api/auth/forgot-password && git commit -m "feat(2.2.2): implement forgot password endpoint"`
  - [ ] Create `/api/auth/reset-password/+server.ts`:
    - [ ] Implement POST handler
    - [ ] Validate reset token
    - [ ] Check token expiration
    - [ ] Validate new password strength
    - [ ] Update password_hash
    - [ ] Invalidate reset token
    - [ ] Clear failed_login_attempts
    - [ ] Log event
    - [ ] Commit: `git add src/routes/api/auth/reset-password && git commit -m "feat(2.2.2): implement reset password endpoint"`
  - [ ] Create `src/lib/types/api.ts` (if not exists):
    - [ ] Define APIResponse interface
    - [ ] Define APIError codes
    - [ ] Define helper functions
    - [ ] Commit: `git add src/lib/types/api.ts && git commit -m "feat(2.2.2): add API response types"`
  - [ ] Create `src/lib/server/auth/utils.ts`:
    - [ ] Email validation function
    - [ ] Password strength validation
    - [ ] Better-Auth error formatting
    - [ ] Authentication event logging
    - [ ] Commit: `git add src/lib/server/auth/utils.ts && git commit -m "feat(2.2.2): add auth utility functions"`
- [ ] **Verify GREEN phase**: All 49 integration tests pass
  - [ ] `pnpm test:integration auth --run` → 49/49 passing ✅

---

**REFACTOR** (REFACTOR Phase):

- [ ] **Extract common patterns**:
  - [ ] Create `handleAPIError()` utility for standardized error responses
  - [ ] Extract rate limiting logic to middleware
  - [ ] Create `validateAuthRequest()` utility for common validation
  - [ ] Commit: `git add -A && git commit -m "refactor(2.2.2): extract common auth API patterns"`
- [ ] **Improve code quality**:
  - [ ] Add comprehensive JSDoc comments to all functions
  - [ ] Replace any remaining `any` types with proper TypeScript types
  - [ ] Add descriptive variable names
  - [ ] Commit: `git add -A && git commit -m "refactor(2.2.2): improve code documentation and types"`
- [ ] **Optimize database operations**:
  - [ ] Add database indexes for failed_login_attempts queries
  - [ ] Optimize session lookups
  - [ ] Commit: `git add -A && git commit -m "refactor(2.2.2): optimize auth database queries"`
- [ ] **Ensure logging consistency**:
  - [ ] Replace all console.log with logger.info
  - [ ] Replace all console.error with logger.error
  - [ ] Add structured logging context (userId, requestId)
  - [ ] Commit: `git add -A && git commit -m "refactor(2.2.2): replace console with universal logger"`
- [ ] **Verify tests still pass**: `pnpm test:integration auth --run` → 49/49 passing ✅

---

**VERIFICATION**:

- [ ] **All 49 integration tests pass**:
  - [ ] `pnpm test:integration auth --run` → 49/49 passing ✅
  - [ ] Review test output for any warnings
- [ ] **Manual API testing**:
  - [ ] Test registration with Postman/curl
  - [ ] Test login with valid credentials
  - [ ] Test login with invalid credentials
  - [ ] Test logout
  - [ ] Test session validation
  - [ ] Test session refresh
  - [ ] Test forgot password flow
  - [ ] Test reset password with valid token
  - [ ] Verify rate limiting works (3, 5, 10 thresholds)
  - [ ] Verify account locking after 10 failed attempts
- [ ] **Database verification**:
  - [ ] Check sessions table has entries after login
  - [ ] Check failed_login_attempts increments on failure
  - [ ] Check password_hash updates on reset
  - [ ] Check reset tokens are invalidated after use
- [ ] **Session cookies verification**:
  - [ ] Session cookie set on login
  - [ ] Session cookie cleared on logout
  - [ ] Session cookie has secure flags in production

---

**QUALITY CHECKS**:

- [ ] **Run diagnostics**: `get_diagnostics_code()` → **Zero errors** ✅
  - [ ] If errors found: Fix using `apply_diff`
  - [ ] Re-check until zero errors
- [ ] **Run linter**: `pnpm lint` → **Zero warnings** ✅
  - [ ] Fix any ESLint warnings
  - [ ] Re-check until zero warnings
- [ ] **Run formatter**: `pnpm format` → **All files formatted** ✅
  - [ ] Commit: `git add -A && git commit -m "style(2.2.2): apply prettier formatting"`
- [ ] **Check test coverage**: `pnpm test:coverage` → **≥80% for auth routes** ✅
  - [ ] Review coverage report
  - [ ] Add tests for any critical uncovered lines
- [ ] **Run full test suite**: `pnpm test` → **All tests pass** ✅
  - [ ] Verify no regressions in other tests

---

**COMPLETION**:

- [ ] **Final verification**:
  - [ ] All 49 tests passing: `pnpm test:integration auth`
  - [ ] Zero diagnostic errors: `get_diagnostics_code()`
  - [ ] Zero linting warnings: `pnpm lint`
  - [ ] Code formatted: `pnpm format`
  - [ ] Git status clean
- [ ] **Merge to main**:
  - [ ] `git checkout main`
  - [ ] `git merge --no-ff phase-2.2.2-auth-api-routes -m "merge: complete step 2.2.2 - Authentication API Routes"`
- [ ] **Update task plan checkboxes**:
  - [ ] Mark this sub-step complete: `- [x] **2.2.2 Create Authentication API Routes**`
  - [ ] Update Testing Requirements: Mark all 6 integration test files as [x]
  - [ ] If all sub-steps in 2.2 complete, mark: `- [x] **2.2 Complete**`
- [ ] **Ready to proceed to step 2.2.3**

---

**Exit Criteria** (Must meet ALL before proceeding to step 2.2.3):

- ✅ All 49 integration tests written and passing (RED → GREEN cycle complete)
- ✅ Code refactored with common patterns extracted (REFACTOR phase complete)
- ✅ Zero TypeScript errors (`get_diagnostics_code()`)
- ✅ Zero ESLint warnings (`pnpm lint`)
- ✅ Code properly formatted (`pnpm format`)
- ✅ Test coverage ≥80% for new auth routes
- ✅ All 7 API routes fully functional:
  - ✅ `/api/auth/register` working
  - ✅ `/api/auth/login` working with rate limiting
  - ✅ `/api/auth/logout` working
  - ✅ `/api/auth/session` working
  - ✅ `/api/auth/refresh` working
  - ✅ `/api/auth/forgot-password` working
  - ✅ `/api/auth/reset-password` working
- ✅ Manual testing confirms all features work
- ✅ Git workflow complete (merged to main)
- ✅ Task plan checkboxes updated
- ✅ Testing Requirements checkboxes updated
- ✅ No blockers or known issues

---
```

**This example shows**:

- Complete transformation from simple task list to comprehensive TDD workflow
- All required sections present
- Specific, actionable steps
- Clear verification criteria
- Git workflow fully integrated
- Cannot proceed until all criteria met

---

### Final Notes for Future Claude Instances

When using this enhanced MVP Task Plan:

1. **Read the Testing Requirements section FIRST** before implementing any step
2. **Always follow RED → GREEN → REFACTOR** cycle for every step
3. **Never skip tests** - they are not optional
4. **Never skip quality checks** - diagnostics, linting, formatting are mandatory
5. **Update checkboxes immediately** after completing each item
6. **Never proceed to next step** until Exit Criteria are met
7. **Use Git workflow** as specified - it enables recovery and progress tracking
8. **Ask for clarification** if any instruction is unclear
9. **Follow the templates exactly** - they encode best practices
10. **Trust the process** - TDD takes longer upfront but saves time debugging

### Why This Level of Detail?

This task plan is intentionally comprehensive and detailed because:

1. **Prevents ambiguity** - No room for misinterpretation
2. **Enforces discipline** - Cannot skip steps or take shortcuts
3. **Enables recovery** - Can resume after interruption
4. **Provides accountability** - Clear what's done and what's not
5. **Maintains quality** - Every quality gate must be passed
6. **Teaches TDD** - Shows exactly how to practice TDD rigorously
7. **Documents decisions** - Captures rationale for approach
8. **Facilitates handoff** - Anyone can continue work

### Success Indicators

You'll know this task plan is successful when:

- ✅ All 11 phases have comprehensive testing requirements
- ✅ All implementation steps reference and complete their tests
- ✅ Future Claude instances follow plan without additional guidance
- ✅ TDD discipline is maintained throughout project
- ✅ Test coverage remains high (≥80%)
- ✅ Regressions are caught immediately by tests
- ✅ Refactoring is done confidently with passing tests
- ✅ Progress is tracked accurately with checkboxes
- ✅ Quality is consistently high across all phases

---

### Appendix: Quick Reference

#### Test Type Decision

**When to write Unit Tests**:

- Pure functions (no dependencies)
- Utility functions
- Validation functions
- Data transformations
- Business logic (mocked dependencies)

**When to write Integration Tests**:

- API endpoints
- Database queries
- Service interactions
- File operations
- External API calls (mocked)

**When to write E2E Tests**:

- Critical user workflows
- Multi-page flows
- Complete business processes
- Authentication flows
- Payment/checkout flows

**When to write Storybook Stories**:

- After tests pass (documentation phase)
- UI components only
- Show all variants and states
- Not tests - visual documentation

#### Database Testing Decision

**Use Transaction Rollback When**:

- Testing isolated database operations
- Unit-like integration tests
- Fast test execution needed
- No complex foreign key dependencies

**Use Full Database Reset When**:

- Testing complete workflows
- Need known starting state
- Testing migrations
- Complex multi-table operations
- Report/analytics testing

#### Test Prioritization (MVT)

**Tier 1 - MVT (Must Have)**:

- Happy path tests
- Critical business logic
- Security-critical operations
- Data integrity operations
- Primary user workflows

**Tier 2 - Should Have**:

- Edge cases
- Error handling
- Secondary workflows
- Performance edge cases

**Tier 3 - Nice to Have**:

- Performance tests
- Visual regression
- Accessibility tests
- Browser compatibility

---

**End of Task Plan `Enhance MVP Task Plan Testing Requirements`**
