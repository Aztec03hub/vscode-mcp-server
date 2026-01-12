## 5. Component Architecture

### 5.1 New Components to Create

````
src/lib/components/quiz/
├── AttemptManagementSheet.svelte    # Main sheet container with view toggle
├── ViewModeToggle.svelte            # NEW: Toggle between flat/grouped views
├── AttemptStatsHeader.svelte        # NEW: Stats summary with Reset Sorts button
├── AttemptFilters.svelte            # Search and filter controls (enhanced)
│
├── # Flat View Components
├── AttemptFlatTable.svelte          # NEW: Flat view table (renamed from AttemptTable)
├── AttemptFlatTableRow.svelte       # NEW: Flat view row (renamed from AttemptTableRow)
│
├── # Grouped View Components
├── AttemptGroupedView.svelte        # NEW: Container for all user cards
├── UserAttemptCard.svelte           # NEW: Card wrapper for single user's attempts
├── UserAttemptHeader.svelte         # NEW: User summary row (name, stats, Delete All)
├── UserAttemptSubTable.svelte       # NEW: Per-user attempt table with sorting
├── UserAttemptSubRow.svelte         # NEW: Single attempt row within user card
│
├── # Shared Components
├── AttemptDetailsSheet.svelte       # NEW: Nested sheet for viewing attempt details
    ├── StatusBadge.svelte               # NEW: Reusable status badge with icon
    ├── ScoreBadge.svelte                # NEW: Reusable score badge with pass/fail icon
    ├── InlineDeleteConfirm.svelte       # NEW: Inline delete confirmation pattern
    ├── DeleteAttemptDialog.svelte       # Modal dialog for bulk/user-level delete
    └── BulkActionsBar.svelte            # NEW: Floating bar for bulk actions
````

    ### 5.2 Component Hierarchy

    ```
    QuizDetailPage (+page.svelte)
├── PageHeader
    │   └── [Admin: Manage Attempts] button (conditional, role-gated)
    ├── Quiz Information Card
    ├── Your Attempts Card (FIXED: current user only)
    ├── PreQuizScreen
│   └── Previous Attempts (FIXED: current user only, with role-gated delete)
│
└── AttemptManagementSheet (conditional, admin only)
        ```

### 5.3 Props Interfaces