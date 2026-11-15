// Opt-in, disposable LOCAL database only. Never load .env implicitly here.
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import pg from "pg"

const url = new URL(process.env.SUPABASE_DB_URL ?? "postgresql://invalid/")
if (
  process.env.A2_CONCURRENCY_TEST_DB !== "1" ||
  !["127.0.0.1", "localhost"].includes(url.hostname) ||
  !/^\/(person_a2|a2_assignment_test\w*)$/.test(url.pathname)
)
  throw new Error(
    "Requires A2_CONCURRENCY_TEST_DB=1 and a disposable local A2 database"
  )

const clients = Array.from(
  { length: 3 },
  () => new pg.Client({ connectionString: url.href })
)
const [admin, first, second] = clients
const event = randomUUID(),
  user = randomUUID(),
  project = randomUUID()
const otherProject = randomUUID()
const email = `a2-concurrency-${user}@example.test`
const claims = JSON.stringify({ sub: user, email, amr: [{ method: "oauth" }] })
async function login(client) {
  await client.query("begin")
  await client.query("select set_config('request.jwt.claims',$1,true)", [
    claims,
  ])
  await client.query("set local role authenticated")
}
async function waitForBlock(pid) {
  for (let n = 0; n < 100; n++) {
    const { rows } = await admin.query(
      "select cardinality(pg_blocking_pids($1))>0 blocked",
      [pid]
    )
    if (rows[0].blocked) return
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error("Expected a real PostgreSQL lock wait")
}
try {
  await Promise.all(clients.map((client) => client.connect()))
  await admin.query(
    "insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",
    [user, email]
  )
  await admin.query(
    "insert into public.admin_allowlist(email,level) values($1,'organizer')",
    [email]
  )
  await admin.query(
    "insert into public.events(id,slug,name) values($1,$2,'A2 concurrency')",
    [event, `a2-concurrency-${event}`]
  )
  await admin.query(
    "insert into public.event_competition_settings(event_id,enabled,project_submissions_open_at,project_submissions_close_at,judging_close_at,general_reviews_per_project) values($1,true,now()-interval '2 days',now()-interval '1 day',now()+interval '1 day',1)",
    [event]
  )
  await admin.query(
    "insert into public.projects(id,event_id,owner_user_id,name,status,submitted_at) values($1,$2,$3,'Concurrency','submitted',now())",
    [project, event, user]
  )
  await admin.query(
    "insert into public.projects(id,event_id,owner_user_id,name,status,submitted_at) values($1,$2,$3,'Other concurrency project','submitted',now())",
    [otherProject, event, user]
  )
  await admin.query(
    "insert into public.event_judges(event_id,email,capacity) values($1,'a2-concurrency-judge@example.test',1),($1,'a2-concurrency-other@example.test',1)",
    [event]
  )
  await admin.query(
    "update public.event_competition_settings set judging_started_at=now() where event_id=$1",
    [event]
  )
  await login(first)
  assert.equal(
    (
      await first.query("select public.admin_generate_assignments($1) result", [
        event,
      ])
    ).rows[0].result.created,
    2
  )
  await login(second)
  const pending = second.query(
    "select public.admin_generate_assignments($1) result",
    [event]
  )
  await waitForBlock(second.processID)
  await first.query("commit")
  assert.deepEqual((await pending).rows[0].result, { created: 0, missing: 0 })
  await second.query("commit")
  assert.equal(
    (
      await admin.query(
        "select count(*)::integer n from public.judging_assignments where event_id=$1",
        [event]
      )
    ).rows[0].n,
    2
  )
  console.log(
    "ok concurrent generation waits, rereads coverage, and creates no duplicates"
  )
  const source = (
    await admin.query(
      "select id from public.judging_assignments where event_id=$1",
      [event]
    )
  ).rows[0].id
  // Simulate a C2 draft save that holds the assignment row, without adding a
  // judge-write bypass to production. The organizer must wait and then recheck.
  await first.query("begin")
  await first.query(
    "update public.judging_assignments set notes='concurrent draft' where id=$1",
    [source]
  )
  await login(second)
  const cancel = second
    .query("select public.admin_cancel_assignment($1,$2)", [event, source])
    .then(
      () => {
        throw new Error("Touched assignment was cancelled")
      },
      (error) => error
    )
  await waitForBlock(second.processID)
  await first.query("commit")
  assert.match((await cancel).message, /Only untouched/)
  await second.query("rollback")
  assert.equal(
    (
      await admin.query(
        "select cancelled from public.judging_assignments where id=$1",
        [source]
      )
    ).rows[0].cancelled,
    false
  )
  console.log(
    "ok cancellation waits for concurrent draft and protects newly saved work"
  )
  // Two manual additions to different projects compete for one remaining slot.
  await admin.query(
    "update public.judging_assignments set cancelled=true where event_id=$1",
    [event]
  )
  const limitedJudge = randomUUID()
  await admin.query(
    "insert into public.event_judges(id,event_id,email,capacity) values($1,$2,'a2-concurrency-limited@example.test',1)",
    [limitedJudge, event]
  )
  await login(first)
  const added = (
    await first.query("select public.admin_add_assignment($1,$2,$3) id", [
      event,
      project,
      limitedJudge,
    ])
  ).rows[0].id
  await login(second)
  const competingAdd = second
    .query("select public.admin_add_assignment($1,$2,$3)", [
      event,
      otherProject,
      limitedJudge,
    ])
    .then(
      () => {
        throw new Error("Capacity was exceeded")
      },
      (error) => error
    )
  await waitForBlock(second.processID)
  await first.query("commit")
  assert.match((await competingAdd).message, /no longer eligible/)
  await second.query("rollback")
  console.log("ok competing manual additions cannot exceed shared capacity")

  const replacementJudge = randomUUID()
  await admin.query(
    "insert into public.event_judges(id,event_id,email,capacity) values($1,$2,'a2-concurrency-replacement@example.test',1)",
    [replacementJudge, event]
  )
  await login(first)
  await first.query("select public.admin_reassign_assignment($1,$2,$3)", [
    event,
    added,
    replacementJudge,
  ])
  await login(second)
  const competingMove = second
    .query("select public.admin_reassign_assignment($1,$2,$3)", [
      event,
      added,
      replacementJudge,
    ])
    .then(
      () => {
        throw new Error("Source was reassigned twice")
      },
      (error) => error
    )
  await waitForBlock(second.processID)
  await first.query("commit")
  assert.match((await competingMove).message, /already cancelled/)
  await second.query("rollback")
  assert.equal(
    (
      await admin.query(
        "select count(*)::integer n from public.judging_assignments where event_id=$1 and not cancelled",
        [event]
      )
    ).rows[0].n,
    1
  )
  console.log(
    "ok concurrent reassignment requests preserve exactly one replacement"
  )
} finally {
  await Promise.allSettled([first.query("rollback"), second.query("rollback")])
  // Only this invocation's disposable fixtures. Unfreeze before scoped cleanup.
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
    email,
  ])
  await admin.query("delete from public.profiles where id=$1", [user])
  await admin.query("delete from auth.users where id=$1", [user])
  await Promise.all(clients.map((client) => client.end()))
}
