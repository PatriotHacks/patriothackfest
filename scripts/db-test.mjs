import { readdir, readFile } from "node:fs/promises"
import pg from "pg"

const dir = "supabase/tests"
const files = (await readdir(dir)).filter((f) => f.endsWith("_test.sql")).sort()
let failed = 0

for (const file of files) {
  const client = new pg.Client({
    connectionString: process.env.SUPABASE_DB_URL,
  })
  await client.connect()
  try {
    const results = await client.query(await readFile(`${dir}/${file}`, "utf8"))
    const tap = results.flatMap((r) =>
      r.rows.flatMap((row) => Object.values(row))
    )
    const problem = tap.find((line) => /^# Looks like/.test(line))
    if (problem) throw new Error(problem.slice(2))
    const passed = tap.filter((line) => /^ok \d+/.test(line)).length
    console.log(`ok   ${file} (${passed} assertions)`)
  } catch (error) {
    failed++
    console.error(`FAIL ${file}: ${error.message}`)
  } finally {
    await client.end()
  }
}

if (failed) {
  console.error(`${failed} of ${files.length} test files failed`)
  process.exit(1)
}
