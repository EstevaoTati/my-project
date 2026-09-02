import React, { useState } from 'react';
import { LayoutAnimation, Platform, Pressable, ScrollView, StyleSheet, Text, UIManager, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Icon } from '../components/Icon';
import type { AccountStackParamList } from '../navigation';
import { colors, fonts, radius, shadow } from '../theme';
import { T, useT } from '../i18n';

type Props = NativeStackScreenProps<AccountStackParamList, 'FAQ'>;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SECTIONS: { title: string; items: { q: string; a: string }[] }[] = [
  {
    title: 'Utiliser 242Konnect',
    items: [
      {
        q: 'Comment trouver un professionnel ?',
        a: "Choisissez une catégorie sur l'accueil, ou tapez votre besoin dans la recherche — par exemple « fuite », « clim » ou « tresses ». Vous verrez les professionnels disponibles avec leur note, leur distance et leur tarif horaire.",
      },
      {
        q: 'Que veut dire « Vérifié par 242K » ?',
        a: "Le badge signale un professionnel dont l'identité et le métier ont été contrôlés. Dans cette version de démonstration, le badge fait partie des données d'exemple : aucune vérification réelle n'a encore lieu.",
      },
      {
        q: 'Comment réserver ?',
        a: "Ouvrez le profil du professionnel, appuyez sur « Réserver maintenant » et choisissez un créneau. La mission apparaît ensuite dans l'onglet Missions, où vous pouvez la payer ou l'annuler.",
      },
      {
        q: 'Puis-je annuler une mission ?',
        a: "Oui : ouvrez l'onglet Missions et appuyez sur « Annuler ». Si vous aviez déjà payé, le montant vous est remboursé tant que la prestation n'a pas commencé. Prévenez aussi le prestataire par message, c'est plus correct.",
      },
    ],
  },
  {
    title: 'Tarifs et paiement',
    items: [
      {
        q: 'Comment sont fixés les prix ?',
        a: "Chaque professionnel affiche son tarif horaire en FCFA. La liste des métiers indique en plus une fourchette indicative pour vous donner un ordre de grandeur avant de contacter quelqu'un.",
      },
      {
        q: 'Quels moyens de paiement acceptez-vous ?',
        a: "MTN Mobile Money, Airtel Money, carte bancaire et virement. En Mobile Money, 242Konnect envoie une demande de paiement sur votre téléphone : vous la validez avec votre code PIN, et rien n'est débité tant que vous ne l'avez pas saisi. Tous les paiements passent par 242Konnect : vous ne réglez jamais le prestataire directement, pas même un pourboire.",
      },
      {
        q: 'Puis-je contacter directement un prestataire ?',
        a: "Les échanges passent par la messagerie 242Konnect, et les numéros et adresses personnels des prestataires ne sont pas publiés. C'est ce qui permet de suivre la demande, la conversation et la prestation sur la plateforme, et de vous appuyer dessus en cas de litige. Aux États-Unis, le contact direct pourra être proposé selon le fonctionnement retenu.",
      },
      {
        q: 'Pourquoi payer avant la prestation ?',
        a: "Le paiement confirme la mission et permet au prestataire de se mettre en route. 242Konnect conserve la somme et ne la verse qu'après votre validation du travail. En cas de litige, elle reste bloquée jusqu'à la décision de la plateforme.",
      },
      {
        q: 'Quelle commission prend 242Konnect ?',
        a: "12 % du montant de la prestation, prélevés automatiquement au moment du versement. Ils couvrent le fonctionnement de la plateforme, la sécurisation des paiements, le support et la maintenance.",
      },
      {
        q: 'Quand le prestataire est-il payé ?',
        a: "Après votre validation. En versement standard, sous 7 jours, avec 1,25 % de frais de traitement. En versement express, immédiatement, avec 4 % de frais.",
      },
      {
        q: 'Puis-je être remboursé ?',
        a: "Oui : annulation avant le début du service, litige tranché en votre faveur, paiement effectué par erreur ou service non réalisé.",
      },
      {
        q: 'Le paiement fonctionne-t-il vraiment ?',
        a: "Non, pas encore. Le parcours complet existe — montant, moyen de paiement, blocage des fonds, validation, commission et versement — mais aucun argent n'est débité ni versé. Un paiement réel demande un compte marchand et un serveur pour le traiter.",
      },

    ],
  },
  {
    title: T('Compte et données'),
    items: [
      {
        q: 'Pourquoi mon numéro sert-il d’identifiant ?',
        a: "Parce qu'à Pointe-Noire c'est par téléphone qu'on se joint. Le préfixe +242 est fixe : le service ne couvre pour l'instant que la République du Congo.",
      },
      {
        q: 'Où sont stockées mes données ?',
        a: "Sur votre appareil uniquement. Votre compte, vos favoris, vos missions et vos messages ne quittent pas ce téléphone et ne sont pas synchronisés. Vous ne pourrez pas vous connecter depuis un autre appareil tant qu'il n'y a pas de serveur.",
      },
      {
        q: 'Comment modifier mon profil ?',
        a: "Onglet Profil, puis « Modifier le profil ». Vous pouvez changer votre nom, ajouter une photo et écrire quelques mots sur vous. Le numéro de téléphone n'est pas modifiable car il identifie le compte.",
      },
      {
        q: 'Comment devenir prestataire sur la plateforme ?',
        a: "Depuis l'onglet Profil, activez le profil Prestataire : un seul compte porte vos profils Particulier, Prestataire et Business, avec un seul identifiant. L'espace Prestataire — demandes reçues, agenda, revenus, Score 242K — reste à construire.",
      },
    ],
  },
  {
    title: T('Sécurité'),
    items: [
      {
        q: 'Que faire en cas de problème avec un professionnel ?',
        a: "Gardez la conversation dans l'application : elle sert de trace. Le signalement et la médiation seront ajoutés avec l'espace professionnel.",
      },
      {
        q: 'Mes conversations sont-elles privées ?',
        a: 'Elles restent sur votre appareil et ne sont envoyées à personne. Cela veut aussi dire que le professionnel ne les reçoit pas encore.',
      },
    ],
  },
];

export function FaqScreen({ navigation }: Props) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState<string | null>(SECTIONS[0].items[0].q);

  const toggle = (q: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((prev) => (prev === q ? null : q));
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('Retour')}
          hitSlop={8}
          style={styles.back}
        >
          <Icon name="solar:alt-arrow-left-linear" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={styles.title}>{t('Questions fréquentes')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {SECTIONS.map((section) => (
          <View key={t(section.title)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t(section.title)}</Text>
            {section.items.map((item) => {
              const expanded = open === item.q;
              return (
                <Pressable
                  key={t(item.q)}
                  onPress={() => toggle(item.q)}
                  accessibilityRole="button"
                  accessibilityLabel={t(item.q)}
                  accessibilityState={{ expanded }}
                  style={[styles.item, expanded && styles.itemOpen]}
                >
                  <View style={styles.itemHead}>
                    <Text style={[styles.question, expanded && styles.questionOpen]}>{t(item.q)}</Text>
                    <View style={expanded ? styles.chevronOpen : undefined}>
                      <Icon
                        name="solar:alt-arrow-down-linear"
                        size={18}
                        color={expanded ? colors.primary : colors.mutedForeground}
                      />
                    </View>
                  </View>
                  {expanded && <Text style={styles.answer}>{t(item.a)}</Text>}
                </Pressable>
              );
            })}
          </View>
        ))}

        <Text style={styles.footer}>{t("Une question qui n'est pas ici ? Écrivez-nous depuis l'onglet Profil une fois le support en ligne.")}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: {
    padding: 8,
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  title: { fontFamily: fonts.heading, fontSize: 20, color: colors.foreground },
  list: { padding: 20, gap: 24 },
  section: { gap: 8 },
  sectionTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.mutedForeground,
    marginBottom: 2,
  },
  item: {
    padding: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
  },
  itemOpen: { borderColor: colors.primary },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  question: { flex: 1, fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.foreground },
  questionOpen: { color: colors.primary },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  answer: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 20,
    color: colors.mutedForeground,
    marginTop: 10,
  },
  footer: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 18,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
});
