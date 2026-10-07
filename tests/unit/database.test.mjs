import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("migration enforces RLS, private files, immutable versions and atomic replay-safe entitlements", async () => {
  const db = new PGlite();
  const creator = "10000000-0000-4000-8000-000000000001";
  const buyer = "10000000-0000-4000-8000-000000000002";
  const stranger = "10000000-0000-4000-8000-000000000003";
  const skill = "20000000-0000-4000-8000-000000000001";
  const secondSkill = "20000000-0000-4000-8000-000000000002";
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema storage;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to anon,authenticated;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit integer,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
      alter table storage.objects enable row level security;
      grant usage on schema storage to anon,authenticated;
      grant select on storage.objects to anon,authenticated;`);
    await db.exec(await readFile("supabase/migrations/20261007191453_marketplace.sql", "utf8"));
    await db.query("insert into auth.users values ($1),($2),($3)", [creator, buyer, stranger]);
    await db.query("insert into public.profiles(id,wallet_address) values ($1,$2),($3,$4),($5,$6)", [creator, "1".repeat(32), buyer, "2".repeat(32), stranger, "3".repeat(32)]);
    await db.query("insert into storage.objects(bucket_id,name) values ('skill-files','private/SKILL.md')");
    await db.exec("set role service_role");
    const privileges = (await db.query("select proname, prosecdef, has_function_privilege('anon', oid, 'EXECUTE') anonymous_access from pg_proc where pronamespace = 'public'::regnamespace and proname in ('submit_skill','create_skill_order','attach_order_signature','finalize_skill_order')")).rows;
    assert.equal(privileges.length, 4);
    for (const fn of privileges) { assert.equal(fn.prosecdef, false); assert.equal(fn.anonymous_access, false); }
    assert.equal((await db.query("select has_table_privilege('service_role','public.purchases','DELETE') allowed")).rows[0].allowed, false);
    const listing = { title: "Test CSV", description: "Supplied records", category: "Solana data", expected_input: "JSON", expected_output: "CSV", requirements: "Agent", limitations: "Offline only", reuse_terms: "Demo", price_lamports: 10000000 };
    for (const id of [skill, secondSkill]) await db.query("select public.submit_skill($1,$2,$3,$4,$5,$6)", [id, creator, listing, `${id}/SKILL.md`, "a".repeat(64), 100]);
    async function asUser(role, id, query, args = []) {
      await db.exec("begin");
      try {
        await db.exec(`set local role ${role}`);
        await db.query("select set_config('request.jwt.claim.sub',$1,true)", [id || ""]);
        const result = await db.query(query, args);
        await db.exec("rollback");
        return result.rows;
      } catch (error) { await db.exec("rollback"); throw error; }
    }
    assert.equal((await asUser("anon", null, "select * from public.skills")).length, 0);
    assert.equal((await asUser("authenticated", creator, "select * from public.skills")).length, 2);
    assert.equal((await asUser("authenticated", buyer, "select * from public.skills")).length, 0);
    assert.equal((await asUser("anon", null, "select * from storage.objects")).length, 0);
    assert.equal((await asUser("authenticated", buyer, "select * from storage.objects")).length, 0);
    await assert.rejects(asUser("authenticated", creator, "select * from public.skill_files"));
    await assert.rejects(asUser("authenticated", creator, "update public.skills set status='approved'"));
    await assert.rejects(asUser("authenticated", buyer, "select public.create_skill_order($1,$2,100)", [buyer, skill]));
    await assert.rejects(asUser("authenticated", buyer, "insert into public.purchases(buyer_id,skill_id,version,order_id) values ($1,$2,1,gen_random_uuid())", [buyer, skill]));
    await db.query("update public.skills set status='approved' where id=$1", [skill]);
    assert.equal((await asUser("anon", null, "select * from public.skills")).length, 1);
    await assert.rejects(db.query("update public.skills set title='Changed' where id=$1", [skill]));
    await assert.rejects(db.query("update public.skill_files set content_hash=$1 where skill_id=$2", ["b".repeat(64), skill]));
    const first = (await db.query("select (public.create_skill_order($1,$2,100)).*", [buyer, skill])).rows[0];
    const repeat = (await db.query("select (public.create_skill_order($1,$2,101)).*", [buyer, skill])).rows[0];
    assert.equal(first.id, repeat.id);
    await assert.rejects(db.query("select public.create_skill_order($1,$2,101)", [creator, skill]));
    await db.query("select public.attach_order_signature($1,$2,$3)", [first.id, buyer, "4".repeat(88)]);
    await assert.rejects(db.query("select public.attach_order_signature($1,$2,$3)", [first.id, buyer, "5".repeat(88)]));
    await assert.rejects(asUser("authenticated", buyer, "select public.finalize_skill_order($1,$2,$3,101)", [first.id, buyer, "4".repeat(88)]));
    await assert.rejects(db.query("select public.finalize_skill_order($1,$2,$3,101)", [first.id, stranger, "4".repeat(88)]));
    await db.query("select public.finalize_skill_order($1,$2,$3,101)", [first.id, buyer, "4".repeat(88)]);
    await db.query("select public.finalize_skill_order($1,$2,$3,101)", [first.id, buyer, "4".repeat(88)]);
    assert.equal((await asUser("authenticated", buyer, "select * from public.purchases")).length, 1);
    assert.equal((await asUser("authenticated", stranger, "select * from public.purchases")).length, 0);
    assert.equal((await asUser("authenticated", creator, "select * from public.orders")).length, 0);
    await assert.rejects(db.query("select public.create_skill_order($1,$2,101)", [buyer, skill]));
    await db.query("update public.skills set status='approved' where id=$1", [secondSkill]);
    const other = (await db.query("select (public.create_skill_order($1,$2,100)).*", [buyer, secondSkill])).rows[0];
    await assert.rejects(db.query("select public.attach_order_signature($1,$2,$3)", [other.id, buyer, "4".repeat(88)]));
    assert.equal((await db.query("select count(*)::int n from public.purchases")).rows[0].n, 1);
  } finally { await db.close(); }
});
