# Initial administrator setup (trusted project owner only)

The normal signup code deliberately does **not** let users choose admin. The SQL `guard_profile_role` trigger prevents anybody, including a browser client, from changing their role during profile updates.

To create the first administrator after signing up as a normal user, a trusted project operator must use the Supabase SQL Editor with privileged database access. **Double-check the target UUID**, then run the following inside an atomic transaction. Do not expose this SQL as an HTTP API or share it with ordinary teammates as a way to self-elevate.

```sql
begin;
alter table public.profiles disable trigger guard_profile_role;
update public.profiles set role='admin'
where id = 'REPLACE_WITH_THE_EXACT_AUTH_USER_UUID';
alter table public.profiles enable trigger guard_profile_role;
commit;
```

Verify the resulting row. If the command errors, roll back and ensure the trigger is enabled; do not leave the trigger disabled. For a production system, replace this one-time bootstrap with audited privileged administration and documented role management procedures.
