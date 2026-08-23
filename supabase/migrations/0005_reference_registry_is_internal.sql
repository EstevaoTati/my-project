-- MWINDA DIGITAL — the reference registry is internal.
--
-- 0003 added projects.sources and projects.grounding so a dossier could carry
-- its own bibliography, and the client rendered that list in the compliance
-- panel and at the end of the dossier.
--
-- That was the wrong call. Which official databases the engine consults, and
-- how it grounds an answer, is methodology — it is the part of MWINDA AI
-- Business Intelligence that took work to assemble, and publishing it with
-- every dossier hands it to anyone who runs one free analysis. The data still
-- shapes every generation; it is simply no longer advertised.
--
-- Nothing is lost for the reader: the compliance stage keeps its legal banner
-- and its per-item "confirm with" field, neither of which names a database.
--
-- These columns were live for less than a day and were never written to in
-- production — the site had no Supabase credentials configured at any point
-- while they existed — so dropping them destroys nothing.
alter table public.projects drop column if exists sources;
alter table public.projects drop column if exists grounding;
