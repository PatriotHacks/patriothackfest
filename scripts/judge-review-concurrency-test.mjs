// Explicit opt-in and committed, invocation-specific LOCAL fixtures only.
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import pg from "pg"

const url = new URL(process.env.SUPABASE_DB_URL ?? "postgresql://invalid/")
if (
  process.env.C2_CONCURRENCY_TEST_DB !== "1" ||
  !["127.0.0.1", "localhost"].includes(url.hostname) ||
  !/^\/(person_c2|c2_review_test\w*)$/.test(url.pathname)
)
  throw new Error(
    "Requires C2_CONCURRENCY_TEST_DB=1 and a disposable local C2 database"
  )

const clients = Array.from(
  { length: 3 },
  () => new pg.Client({ connectionString: url.href })
)
const [admin, first, second] = clients
const event = randomUUID(),
  owner = randomUUID(),
  user = randomUUID(),
  judge = randomUUID(),
  replacement = randomUUID(),
  criterion = randomUUID()
const slug = `c2-race-${event}`,
  email = `${user}@example.test`
const scores = { [criterion]: 3.5 }
const judgeClaims = { sub: user, email, amr: [{ method: "otp" }] }
const organizerClaims = {
  sub: owner,
  email: `${owner}@example.test`,
  amr: [{ method: "oauth" }],
}
async function login(client, claims) {
  await client.query("begin")
  await client.query("select set_config('request.jwt.claims',$1,true)", [
    JSON.stringify(claims),
  ])
  await client.query("set local role authenticated")
}
async function waitForBlock(client) {
  const end = Date.now() + 5000
  while (Date.now() < end) {
    if (
      (
        await admin.query(
          "select cardinality(pg_blocking_pids($1))>0 blocked",
          [client.processID]
        )
      ).rows[0].blocked
    )
      return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error("Expected PostgreSQL lock wait")
}
function save(client, id, submit = false, value = scores) {
  return client.query(
    "select public.judge_save_review($1,$2,$3,$4,$5) result",
    [slug, id, value, "real draft", submit]
  )
}
function outcome(promise) {
  return promise.then(
    (value) => ({ value }),
    (error) => ({ error })
  )
}
const projectOwners = []
async function assignment() {
  const project = randomUUID(),
    id = randomUUID(),
    projectOwner = randomUUID()
  projectOwners.push(projectOwner)
  // Make fixtures before the event's permanent content freeze.
  await admin.query(
    "update public.event_competition_settings set judging_started_at=null where event_id=$1",
    [event]
  )
  // One team per participant: each project gets its own owner.
  await admin.query("insert into auth.users(id,email) values($1,$2)", [
    projectOwner,
    `${projectOwner}@example.test`,
  ])
  await admin.query(
    "insert into public.projects(id,event_id,owner_user_id,status,submitted_at) values($1,$2,$3,'submitted',now())",
    [project, event, projectOwner]
  )
  await admin.query(
    "insert into public.judging_assignments(id,event_id,project_id,judge_id) values($1,$2,$3,$4)",
    [id, event, project, judge]
  )
  await admin.query(
    "update public.event_competition_settings set judging_started_at=now(),judging_close_at=clock_timestamp()+interval '1 day' where event_id=$1",
    [event]
  )
  return id
}
try {
  await Promise.all(clients.map((client) => client.connect()))
  await admin.query(
    "insert into auth.users(id,email,email_confirmed_at) values($1,$2,now()),($3,$4,now())",
    [owner, `${owner}@example.test`, user, email]
  )
  await admin.query(
    "insert into public.admin_allowlist(email,level) values($1,'organizer')",
    [`${owner}@example.test`]
  )
  await admin.query(
    "insert into public.events(id,slug,name) values($1,$2,'C2 concurrency')",
    [event, slug]
  )
  await admin.query(
    "insert into public.event_competition_settings(event_id,enabled,project_submissions_open_at,project_submissions_close_at,judging_close_at) values($1,true,now()-interval '3 days',now()-interval '2 days',now()+interval '1 day')",
    [event]
  )
  await admin.query(
    "insert into public.judging_criteria(id,event_id,position,name) values($1,$2,1,'Criterion A')",
    [criterion, event]
  )
  await admin.query(
    "insert into public.event_judges(id,event_id,email,user_id,briefing_acknowledged_at) values($1,$2,$3,$4,now())",
    [judge, event, email, user]
  )
  await admin.query(
    "insert into public.event_judges(id,event_id,email) values($1,$2,$3)",
    [replacement, event, `${replacement}@example.test`]
  )

  for (const operation of ["cancel", "reassign"]) {
    for (const judgeFirst of [true, false]) {
      const id = await assignment()
      const manage = (client) =>
        client.query(
          operation === "cancel"
            ? "select public.admin_cancel_assignment($1,$2)"
            : "select public.admin_reassign_assignment($1,$2,$3)",
          operation === "cancel" ? [event, id] : [event, id, replacement]
        )
      await login(first, judgeFirst ? judgeClaims : organizerClaims)
      await (judgeFirst ? save(first, id) : manage(first))
      await login(second, judgeFirst ? organizerClaims : judgeClaims)
      const pending = outcome(judgeFirst ? manage(second) : save(second, id))
      await waitForBlock(second)
      await first.query("commit")
      assert.match(
        (await pending).error?.message ?? "",
        judgeFirst ? /Only untouched/ : /Assignment unavailable/
      )
      await second.query("rollback")
      console.log(
        `ok real save/${operation}, ${judgeFirst ? "save" : operation} wins`
      )
    }
  }

  let id = await assignment()
  await login(first, organizerClaims)
  await first.query(
    "select public.admin_save_event_judge($1,$2,'general',false,20,'{}',$3)",
    [event, email, judge]
  )
  await login(second, judgeClaims)
  let pending = outcome(save(second, id))
  await waitForBlock(second)
  await first.query("commit")
  assert.match((await pending).error?.message ?? "", /Judge access unavailable/)
  await second.query("rollback")
  await admin.query("update public.event_judges set active=true where id=$1", [
    judge,
  ])
  console.log("ok deactivation wins against a waiting judge save")

  for (const extend of [false, true]) {
    id = await assignment()
    if (extend)
      await admin.query(
        "update public.event_competition_settings set judging_close_at=clock_timestamp()-interval '1 hour' where event_id=$1",
        [event]
      )
    await first.query("begin")
    await first.query(
      "update public.event_competition_settings set judging_close_at=clock_timestamp()+$2::interval where event_id=$1",
      [event, extend ? "1 day" : "150 milliseconds"]
    )
    await login(second, judgeClaims)
    pending = outcome(save(second, id))
    await waitForBlock(second)
    if (!extend) {
      const end = Date.now() + 5000
      while (
        !(
          await first.query(
            "select clock_timestamp()>=judging_close_at expired from public.event_competition_settings where event_id=$1",
            [event]
          )
        ).rows[0].expired
      ) {
        assert.ok(Date.now() < end, "clock must reach deadline")
        await new Promise((resolve) => setTimeout(resolve, 10))
      }
    }
    await first.query("commit")
    const result = await pending
    if (extend) {
      assert.equal(result.value?.rows[0].result.notes, "real draft")
      await second.query("commit")
    } else {
      assert.match(result.error?.message ?? "", /Judging has ended/)
      await second.query("rollback")
    }
    console.log(
      `ok waiting save observes ${extend ? "post-expiry extension" : "actual cutoff, not transaction-start time"}`
    )
  }

  id = await assignment()
  await login(first, judgeClaims)
  const original = (await save(first, id, true)).rows[0].result
  await login(second, judgeClaims)
  pending = outcome(save(second, id, true, { [criterion]: 5 }))
  await waitForBlock(second)
  await first.query("commit")
  const edited = (await pending).value?.rows[0].result
  assert.deepEqual(edited?.scores, { [criterion]: 5 })
  assert.equal(edited?.submitted_at, original.submitted_at)
  await second.query("commit")
  console.log(
    "ok concurrent edits of a submitted review apply in order and keep the first submission time"
  )
} finally {
  await Promise.allSettled([first.query("rollback"), second.query("rollback")])
  await admin.query(
    "update public.event_competition_settings set judging_started_at=null where event_id=$1",
    [event]
  )
  await admin.query(
    "delete from public.judging_assignments where event_id=$1",
    [event]
  )
  await admin.query("delete from public.event_judges where event_id=$1", [
    event,
  ])
  await admin.query("delete from public.projects where event_id=$1", [event])
  await admin.query(
    "delete from public.event_competition_settings where event_id=$1",
    [event]
  )
  await admin.query("delete from public.events where id=$1", [event])
  await admin.query("delete from public.admin_allowlist where email=$1", [
    `${owner}@example.test`,
  ])
  await admin.query("delete from public.profiles where id=any($1::uuid[])", [
    [owner, user, ...projectOwners],
  ])
  await admin.query("delete from auth.users where id=any($1::uuid[])", [
    [owner, user, ...projectOwners],
  ])
  await Promise.all(clients.map((client) => client.end()))
}
