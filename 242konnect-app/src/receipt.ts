import { Platform, Share } from 'react-native';
import { formatFcfaFull } from './data';
import { paymentMethodLabel } from './payments';
import type { Booking, Payment } from './store';

/**
 * Receipts the client can actually keep.
 *
 * The correction note asks for four things after a payment: a notification, a
 * visible payment status, a generated receipt, and — separately — that the
 * client can **download** it. The first two live in the store and the missions
 * screen; this file is the last two.
 *
 * The receipt is built as HTML rather than PDF. A PDF needs `expo-print`, which
 * needs a native module, and on the web build that route is unavailable
 * anyway. HTML opens in any browser, prints to PDF from there, carries the
 * brand mark, and costs nothing to generate. When the app ships natively,
 * swapping this for `Print.printToFileAsync` is a one-function change; the
 * layout below is already print-shaped.
 */

export type ReceiptData = {
  booking: Booking;
  payment: Payment;
  professionalName: string;
  tradeLabel: string;
  clientName: string;
  clientPhone: string;
};

const FR_DATE = (at: number) =>
  new Date(at).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

/** The mark, inline, so a saved receipt stays complete offline. */
const MARK = `<svg viewBox="0 0 787 288" width="132" height="48" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="gc"><polygon points="444,0 787,0 787,288 306,288 306,138"/></clipPath>
    <clipPath id="rc"><polygon points="0,0 469,0 469,151 332,288 0,288"/></clipPath>
    <clipPath id="th"><rect x="0" y="0" width="787" height="144"/></clipPath>
    <clipPath id="bh"><rect x="0" y="144" width="787" height="144"/></clipPath>
    <mask id="gv" maskUnits="userSpaceOnUse" x="0" y="0" width="787" height="288">
      <rect width="787" height="288" fill="#fff"/>
      <g clip-path="url(#bh)"><rect x="342.5" y="36.5" width="408" height="215" rx="107.5" fill="none" stroke="#000" stroke-width="107"/></g>
    </mask>
    <mask id="rv" maskUnits="userSpaceOnUse" x="0" y="0" width="787" height="288">
      <rect width="787" height="288" fill="#fff"/>
      <g clip-path="url(#th)"><rect x="36.5" y="36.5" width="396" height="215" rx="107.5" fill="none" stroke="#000" stroke-width="107"/></g>
    </mask>
  </defs>
  <g mask="url(#gv)">
    <rect x="36.5" y="36.5" width="396" height="215" rx="107.5" fill="none" stroke="#029b4f" stroke-width="73"/>
    <g clip-path="url(#gc)"><rect x="36.5" y="36.5" width="396" height="215" rx="107.5" fill="none" stroke="#fbd218" stroke-width="73"/></g>
  </g>
  <g mask="url(#rv)">
    <rect x="342.5" y="36.5" width="408" height="215" rx="107.5" fill="none" stroke="#e4181f" stroke-width="73"/>
    <g clip-path="url(#rc)"><rect x="342.5" y="36.5" width="408" height="215" rx="107.5" fill="none" stroke="#fbd218" stroke-width="73"/></g>
  </g>
</svg>`;

const escape = (value: string) =>
  value.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
  );

export function receiptFilename(payment: Payment): string {
  return `242Konnect-recu-${payment.reference}.html`;
}

/** The receipt as a standalone HTML document. */
export function renderReceipt(data: ReceiptData): string {
  const { booking, payment, professionalName, tradeLabel, clientName, clientPhone } = data;
  const settlement = booking.settlement;

  const row = (label: string, value: string, strong = false) => `
    <tr>
      <td class="k">${escape(label)}</td>
      <td class="v${strong ? ' strong' : ''}">${escape(value)}</td>
    </tr>`;

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reçu ${escape(payment.reference)} — 242Konnect</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 32px 20px;
    background: #f4f4f5;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    color: #0a0a0a;
  }
  .sheet {
    max-width: 640px; margin: 0 auto; background: #fff;
    border: 1px solid #e5e5e5; border-radius: 16px; padding: 32px;
  }
  header { display: flex; align-items: center; gap: 14px; margin-bottom: 4px; }
  header h1 { font-size: 19px; margin: 0; letter-spacing: -0.2px; }
  .ref { color: #6b7280; font-size: 13px; margin: 2px 0 24px; }
  .amount { font-size: 34px; font-weight: 700; letter-spacing: -0.5px; margin: 0; }
  .amount span { font-size: 17px; font-weight: 600; color: #6b7280; }
  .status {
    display: inline-block; margin-top: 10px; padding: 5px 11px; border-radius: 999px;
    font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
  }
  .paid { background: #f0fdf4; color: #15803d; }
  .held { background: #fffbeb; color: #b45309; }
  table { width: 100%; border-collapse: collapse; margin-top: 26px; }
  td { padding: 11px 0; border-bottom: 1px solid #f0f0f1; font-size: 14px; vertical-align: top; }
  tr:last-child td { border-bottom: 0; }
  .k { color: #6b7280; width: 46%; }
  .v { text-align: right; font-weight: 500; }
  .v.strong { font-weight: 700; }
  h2 {
    font-size: 11px; text-transform: uppercase; letter-spacing: 0.7px;
    color: #6b7280; margin: 28px 0 0;
  }
  .note {
    margin-top: 26px; padding: 14px; border-radius: 10px; background: #f4f4f5;
    font-size: 12.5px; line-height: 1.55; color: #4b5563;
  }
  footer { margin-top: 22px; font-size: 11.5px; color: #9ca3af; text-align: center; }
  @media print {
    body { background: #fff; padding: 0; }
    .sheet { border: 0; border-radius: 0; padding: 0; max-width: none; }
  }
</style>
</head>
<body>
  <div class="sheet">
    <header>${MARK}<h1>242Konnect</h1></header>
    <p class="ref">Reçu ${escape(payment.reference)} · ${escape(FR_DATE(payment.createdAt))}</p>

    <p class="amount">${escape(formatFcfaFull(payment.amount))} <span>FCFA</span></p>
    <span class="status ${settlement ? 'paid' : 'held'}">
      ${settlement ? 'Prestation validée' : 'Fonds conservés par 242Konnect'}
    </span>

    <h2>Prestation</h2>
    <table>
      ${row('Prestataire', professionalName)}
      ${row('Métier', tradeLabel)}
      ${row('Créneau', booking.slot)}
      ${row('Référence mission', booking.id.slice(0, 8).toUpperCase())}
    </table>

    <h2>Paiement</h2>
    <table>
      ${row('Moyen', paymentMethodLabel(payment.method))}
      ${payment.payerPhone ? row('Numéro débité', `+${payment.payerPhone}`) : ''}
      ${payment.operatorReference ? row('Transaction opérateur', payment.operatorReference) : ''}
      ${row('Payé par', clientName)}
      ${row('Contact', clientPhone)}
      ${row('Montant réglé', `${formatFcfaFull(payment.amount)} FCFA`, true)}
    </table>

    ${
      settlement
        ? `<h2>Répartition</h2>
    <table>
      ${row('Commission 242Konnect (12 %)', `${formatFcfaFull(Math.round(settlement.commission))} FCFA`)}
      ${row(
        `Frais de versement (${settlement.speed === 'express' ? '4' : '1,25'} %)`,
        `${formatFcfaFull(Math.round(settlement.payoutFee))} FCFA`
      )}
      ${row('Versé au prestataire', `${formatFcfaFull(Math.round(settlement.net))} FCFA`, true)}
    </table>`
        : ''
    }

    <p class="note">
      Tous les paiements passent par 242Konnect. Le prestataire n'est réglé qu'après votre
      validation de la prestation. Ne remettez jamais d'argent directement au prestataire,
      même en pourboire.
    </p>

    <footer>242Konnect · Pointe-Noire, République du Congo</footer>
  </div>
</body>
</html>`;
}

/**
 * Hands the receipt to the person.
 *
 * On web this triggers a real file download; elsewhere it opens the share
 * sheet, which is how a phone lets you keep a document. Returns false when
 * neither route is available, so the caller can say so rather than appear to
 * have done something.
 */
export async function downloadReceipt(data: ReceiptData): Promise<boolean> {
  const html = renderReceipt(data);
  const filename = receiptFilename(data.payment);

  if (Platform.OS === 'web') {
    if (typeof document === 'undefined') return false;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Revoked on the next tick: revoking immediately can cancel the download in
    // some browsers before it has started reading the blob.
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  }

  try {
    await Share.share({ title: filename, message: html });
    return true;
  } catch {
    return false;
  }
}
