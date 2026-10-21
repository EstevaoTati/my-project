-- Three accounts for the tests: A (client), B (prestataire), C (stranger).
insert into auth.users (id, email, created_at) values
  ('00000000-0000-4000-8000-00000000000a', 'client.a@example.test',   now() - interval '3 days'),
  ('00000000-0000-4000-8000-00000000000b', 'presta.b@example.test',   now() - interval '2 days'),
  ('00000000-0000-4000-8000-00000000000c', 'stranger.c@example.test', now() - interval '1 day');
insert into public.profiles (id, email, phone, full_name, city) values
  ('00000000-0000-4000-8000-00000000000b', 'presta.b@example.test', '242000000002', 'Presta B', 'Pointe-Noire'),
  ('00000000-0000-4000-8000-00000000000c', 'stranger.c@example.test', '242000000003', 'Stranger C', 'Brazzaville');
