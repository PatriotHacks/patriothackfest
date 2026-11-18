# Project teams

A team is a project's owner (`projects.owner_user_id`) plus its collaborators
(`project_collaborators`). Migrations `20261118000001_team_settings.sql` and
`20261118000002_team_membership.sql`.

## Rules

- **Editing:** every member can edit content and answers, upload/delete project
  files, and submit. Drafts autosave per field with `participant_patch_project`, so
  teammates editing different questions never overwrite each other; on the same
  field the later save wins. Open editors poll `participant_project_version` and
  merge teammates' changes into fields the user is not editing. Saves of submitted
  projects rely on `p_expected_updated_at`; a stale save fails with `PT409` and the
  form says someone else saved and offers a reload. See
  [Draft autosave](project-submissions.md#draft-autosave).
- **Roster:** any member adds a teammate by exact registered email; they join
  immediately (no invitation). Only the owner removes teammates. A collaborator can leave; the owner cannot (no ownership transfer).
- **Eligibility:** members need a submitted and accepted application for the event.
  Unknown, ineligible, or self addresses get one generic error. Only after that
  check passes can a caller learn that the person is already on a team or that the
  team is full. Submitting or saving a submitted project rechecks every member,
  owner included.
- **One team per event:** a user can be a member of at most one non-withdrawn
  project per event. Withdrawn projects stop counting, so their members can join or
  create another team. Enforced by the `projects_one_team` and
  `collaborators_one_team` triggers (`enforce_project_team`), including writes from
  privileged sessions. Every membership change locks the event's
  `event_competition_settings` row first, so concurrent adds/creates serialize per
  event. The membership migration aborts with the offending event/user ids if
  existing data violates the rule (`assert_one_team_per_event`); resolve those by
  hand before applying it.
- **Team size:** `event_competition_settings.max_team_size` (null means unlimited)
  counts the owner. Adding beyond it fails. Organizers set it under **Teams** in
  Submission Forms; it cannot be set below the size of any current non-withdrawn
  team. Participants see `x / N members` when a limit is set.
- **Judges:** `judge_assignment` returns `team` (owner first, then collaborators,
  full names only, never emails) only while **Judges can see team member names**
  (`judges_see_team`, default off) is on. Blank names show as "Unnamed
  participant". Organizers always see owner and collaborator names. Team members
  are still excluded from assignment candidates and from judging their own project.
- Judging start freezes rosters, like project content.

## API

```text
participant_add_project_collaborator(p_project_id, p_email)   any member
participant_remove_project_collaborator(p_project_id, p_user_id)  owner only
participant_leave_project(p_project_id)                       collaborators only
participant_withdraw_project(p_project_id)                    owner only; unused by the app
admin_set_max_team_size(p_event_id, p_value default null)     organizer
admin_set_judges_see_team(p_event_id, p_value)                organizer
```

`participant_project_detail` includes `owner` and `max_team_size`.

## Manual checks

1. With A as owner, add B; as B, add C. B and C can edit and submit; only A sees
   Remove buttons. C leaves from the Team section after confirming.
2. With A and B on the same draft in two browsers, A edits one question while B
   edits another: within a few seconds each sees the other's answer, marked
   "Updated by a teammate", and neither loses their own. While B is typing in a
   field, A's change to that field does not replace B's text; B's save wins.
3. Try adding someone already on another team: "already on a team for this event".
   They also cannot create a project for the event.
4. Set a limit of 2 with a three-person team: the admin save is rejected. Set it to
   3, then adding a fourth member fails.
5. Turn on judge team visibility and open an assignment as a judge: names appear,
   emails never do. Turn it off: the Team block disappears.
