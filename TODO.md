# Add User Activity Profile Access from Manage Users (SuperAdmin & Admin)

## Current Progress:
- [x] **Step 0**: Analyzed files, created plan ✅
- [ ] **Step 1**: Fix SuperAdmin.jsx UserRow Activity button + modal positioning
- [ ] **Step 2**: Update Admin.jsx users table Activity button + modal
- [ ] **Step 3**: Test functionality in both files
- [ ] **Step 4**: Mark complete → attempt_completion

## Detailed Steps:
### Step 1: SuperAdmin.jsx Fixes
- Remove UserAuditProfile from inside AdminList map loop
- Add conditional render `{selectedUserProfile && <UserAuditProfile profile={selectedUserProfile} logs={logsData} onBack={handleCloseUserProfile} />}` in logs-audit view
- Ensure UserList passes `onViewActivity={handleOpenUserProfile}` to UserRow
- Fix UserRow `onViewActivity={() => handleOpenUserProfile(user)}`

### Step 2: Admin.jsx Updates  
- Add `const [selectedUserProfile, setSelectedUserProfile] = useState(null);`
- Copy `handleOpenUserProfile`, `handleCloseUserProfile` from SuperAdmin
- Copy `UserAuditProfile` component (uses shared utils)
- In users table: Add Activity button to each row: `<button onClick={() => handleOpenUserProfile(user)} ...>Activity</button>`
- Add conditional modal render in users view or dedicated logs view

### Step 3: Testing
- Navigate SuperAdmin → Manage Users → Click Activity → Verify user-specific modal/logs
- Navigate Admin → Users → Click Activity → Verify same functionality
- Check console errors fixed (handleOpenUserProfile ReferenceError)

### Step 4: Completion
- Update this TODO.md
- attempt_completion

**Next Action**: Proceed with Step 1 (SuperAdmin.jsx fixes)

