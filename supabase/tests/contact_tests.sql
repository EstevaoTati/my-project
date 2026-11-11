-- Tests for supabase/migrations/20261111000000_contact_requests.sql.
-- Run by supabase/tests/run-local.sh; also safe to paste into the production
-- SQL editor. Everything rolls back.
--   A: client (oldest account). B, C: accounts with no listing yet; B is made
--   a prestataire of A's country, C of the other country.
begin;
create temp table t (n serial, step text, ok boolean, detail text) on commit drop;
grant insert, select on t to authenticated;
grant usage on sequence t_n_seq to authenticated;

do $$
declare
  a uuid := (select id from auth.users order by created_at limit 1);
  free uuid[] := (select array_agg(id order by created_at) from (
                    select u.id, u.created_at from auth.users u
                    where u.id <> (select id from auth.users order by created_at limit 1)
                      and not exists (select 1 from public.provider_listings l where l.id = u.id)
                    order by u.created_at limit 2) x);
  b uuid := free[1]; c uuid := free[2];
  home text; abroad text;
  req uuid; req2 uuid; v text; n int;
  claims constant text := 'request.jwt.claims';
begin
  insert into public.profiles (id, email, phone, phone_country, full_name, country, city, profiles, active_profile)
    values (a, (select lower(email) from auth.users where id = a), '242000000982', 'CG', 'Client A', 'CG', 'Pointe-Noire', array['particulier'], 'particulier')
    on conflict (id) do nothing;
  select country into home from public.profiles where id = a;
  abroad := case when home = 'US' then 'CG' else 'US' end;
  insert into public.provider_listings (id, full_name, trade_id, zone, city, country, pricing, durations, bio, status) values
    (b, 'Prestataire B', 'plombier', 'Centre', 'Ville', home, '{"model":"quote"}', '{hours}', 'bio', 'approved'),
    (c, 'Prestataire C', 'plombier', 'Centre', 'Ailleurs', abroad, null, '{hours}', 'bio', 'approved');

  perform set_config(claims, json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  begin
    perform public.contact_provider(b, '   ');
    insert into t(step, ok) values ('a contact needs a message', false);
  exception when others then
    insert into t(step, ok, detail) values ('a contact needs a message', sqlerrm = 'a message is required', sqlerrm);
  end;
  begin
    perform public.contact_provider(c, 'Bonjour');
    insert into t(step, ok) values ('a prestataire of another country cannot be contacted', false);
  exception when others then
    insert into t(step, ok, detail) values ('a prestataire of another country cannot be contacted', sqlerrm like '%not available in your country', sqlerrm);
  end;
  begin
    perform public.contact_provider(a, 'Bonjour');
    insert into t(step, ok) values ('nobody contacts themselves', false);
  exception when others then
    insert into t(step, ok, detail) values ('nobody contacts themselves', true, sqlerrm);
  end;
  execute 'reset role';
  update public.provider_listings set status = 'pending' where id = b;
  execute 'set local role authenticated';
  begin
    perform public.contact_provider(b, 'Bonjour');
    insert into t(step, ok) values ('an unapproved prestataire cannot be contacted', false);
  exception when others then
    insert into t(step, ok, detail) values ('an unapproved prestataire cannot be contacted', true, sqlerrm);
  end;
  execute 'reset role';
  update public.provider_listings set status = 'approved' where id = b;
  execute 'set local role authenticated';

  select public.contact_provider(b, 'Bonjour, pouvez-vous passer ? Mon numéro : 06 123 45 67') into req;
  select kind || '/' || status || '/' || coalesce(amount::text, 'null') || '/' || (payment_verified_at is null)::text into v
    from public.service_requests where id = req;
  insert into t(step, ok, detail) values ('a contact request is sent at once, with no amount and no payment', v = 'inquiry/sent/null/true', v);
  select body into v from public.request_messages where request_id = req;
  insert into t(step, ok, detail) values ('its first message is stored, phone number masked', v like 'Bonjour%' and v not like '%123 45 67%', v);
  select description into v from public.service_requests where id = req;
  insert into t(step, ok, detail) values ('and so is the summary the prestataire reads on the card', v like 'Bonjour%' and v like '%•••%' and v not like '%123 45 67%', v);
  select public.contact_provider(b, 'Encore moi') into req2;
  select count(*) into n from public.request_messages where request_id = req;
  insert into t(step, ok, detail) values ('writing again continues the same conversation', req2 = req and n = 2, n::text);
  begin
    insert into public.service_requests (provider_id, slot, amount, idempotency_key) values (b, 'Demain', null, 'contact-test-01');
    insert into t(step, ok) values ('the app cannot create a request with no amount itself', false);
  exception when others then
    insert into t(step, ok, detail) values ('the app cannot create a request with no amount itself', sqlerrm = 'a request needs an amount', sqlerrm);
  end;
  begin
    insert into public.service_requests (provider_id, slot, amount, idempotency_key, kind) values (b, 'Demain', 5000, 'contact-test-02', 'inquiry');
    insert into t(step, ok) values ('nor choose the kind', false);
  exception when insufficient_privilege then
    insert into t(step, ok) values ('nor choose the kind', true);
  end;

  perform set_config(claims, json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from public.service_requests where id = req;
  insert into t(step, ok, detail) values ('the prestataire receives it', n = 1, n::text);
  select count(*) into n from public.service_request_private where request_id = req;
  insert into t(step, ok, detail) values ('with no address', n = 0, n::text);
  insert into public.request_messages (request_id, body) values (req, 'Bonjour, oui. Écrivez-moi sur b@mail.cg');
  select body into v from public.request_messages where request_id = req order by id desc limit 1;
  insert into t(step, ok, detail) values ('and answers in the conversation, e-mail masked', v not like '%@mail%', v);
  select unread into n from public.my_conversations() where request_id = req;
  insert into t(step, ok, detail) values ('it is a conversation with unread messages', n = 2, coalesce(n::text, 'none'));
  begin
    perform public.request_action(req, 'accept');
    insert into t(step, ok) values ('it cannot be accepted as a paid mission', false);
  exception when others then
    insert into t(step, ok, detail) values ('it cannot be accepted as a paid mission', sqlerrm = 'payment not verified', sqlerrm);
  end;

  perform set_config(claims, json_build_object('sub', c, 'role', 'authenticated')::text, true);
  select count(*) into n from public.service_requests where id = req;
  insert into t(step, ok, detail) values ('a stranger sees nothing of it', n = 0, n::text);

  execute 'reset role';
  select status into v from public.confirm_payment(req, 'mtn', 'MTN-INQ-0001', 1);
  insert into t(step, ok, detail) values ('a payment cannot be attached to it', v = 'sent', v);

  perform set_config(claims, json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.request_action(req, 'decline');
  begin
    insert into public.request_messages (request_id, body) values (req, 'encore');
    insert into t(step, ok) values ('declined, the conversation is closed', false);
  exception when others then
    insert into t(step, ok) values ('declined, the conversation is closed', true);
  end;
  perform set_config(claims, json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select public.contact_provider(b, 'Une autre question') into req2;
  insert into t(step, ok) values ('a new contact can be opened afterwards', req2 <> req);
  execute 'reset role';
end;
$$;

select n, ok, step, detail from t order by n;
rollback;
