# 242Konnect — approuver un compte prestataire

Un prestataire qui s'inscrit est en statut `pending` : il voit son propre
profil, mais **aucun client ne le voit** et personne ne peut le contacter.
Il apparaît dans sa catégorie, dans son pays, dès que son statut passe à
`approved`.

## Avant d'approuver

Vérifier, dans Supabase → Table Editor → `provider_listings` :

- `full_name` : un vrai nom (pas « test », pas de nom répété) ;
- `trade_id` : le bon métier — c'est lui qui place le prestataire dans sa
  catégorie ;
- `country` et `city` : le pays décide quels clients le voient (`US` ou `CG`) ;
- `zone`, `bio`, `pricing` : renseignés et cohérents ;
- les pièces justificatives : table `profiles`, colonne `prestataire`, même `id`
  que la ligne de `provider_listings`.

## Approuver

**Table Editor** : ouvrir `provider_listings`, filtrer `status = pending`,
double-cliquer la cellule `status`, écrire `approved`, valider.

**Ou SQL Editor**, pour un compte précis :

```sql
update public.provider_listings
   set status = 'approved', refusal_reason = null, updated_at = now()
 where id = '<id du prestataire>';
```

Lister ceux qui attendent :

```sql
select id, full_name, trade_id, city, country, updated_at
  from public.provider_listings
 where status = 'pending'
 order by updated_at;
```

## Refuser

```sql
update public.provider_listings
   set status = 'refused', refusal_reason = 'Pièce d''identité illisible', updated_at = now()
 where id = '<id du prestataire>';
```

Le motif est affiché au prestataire dans son espace.

## À savoir

- L'application rafraîchit la liste toutes les 30 secondes : un prestataire
  approuvé apparaît chez les clients de son pays sans mise à jour.
- Un compte créé avant la mise en ligne de l'annuaire n'a pas de ligne dans
  `provider_listings` : elle se crée à sa prochaine connexion.
- Approuver ne donne aucun droit d'administration : seul le statut change.
