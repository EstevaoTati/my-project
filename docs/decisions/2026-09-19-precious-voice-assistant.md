# PRECIOUS: a voice-only assistant, in the browser, installable as an app

**Date:** 2026-09-19
**Status:** shipped
**Surface:** `/precious` (page), `netlify/functions/precious.mjs` (brain)

## The ask

A "Jarvis": a virtual assistant the founder talks to, that answers out loud,
that can be installed on a computer and on a phone, with a fully technical
look, and with **no keyboard option at all** — everything by voice.

## What was built

A voice operating system called PRECIOUS, shipped as a page of this site:

- **Ears.** The browser's own speech recognition, running continuously with
  interim results, committing an utterance after 1.1 s of silence.
- **Eyes.** A canvas reactor whose crown is the live microphone spectrum, so
  the operator can see at a glance whether the machine is actually hearing
  them. Colour encodes state: gold on standby, cyan listening, amber
  thinking, pale gold speaking, red on error.
- **Brain.** `netlify/functions/precious.mjs` — Claude with nine device
  tools, behind the same security primitives as every other endpoint here.
- **Mouth.** Speech synthesis, with the voice chosen per language.
- **Hands.** Nine local actions: remember, forget, clear memory, set timer,
  cancel timers, open a page of this site, set language, set speaking rate,
  stop listening.
- **Body.** A web app manifest and a service worker scoped to `/precious`,
  so it installs on desktop and mobile and opens as a standalone app.

## Decisions worth recording

**No text input, anywhere.** Not as a fallback, not "for accessibility", not
hidden behind a toggle. The brief was explicit and the constraint is what
makes the product a product: every design question resolves to "how does
this work when the only channel is a voice?". Browsers without speech
recognition get an honest dead-end screen naming the ones that work, rather
than a keyboard that would quietly make it an ordinary chat box.

**Half-duplex: the microphone closes while PRECIOUS speaks.** On a laptop or
a phone the microphone hears the loudspeaker. Left open, the recogniser
transcribes the machine's own voice and it answers itself, forever.
Interrupting is one tap on the core. This is the single biggest correctness
decision in the build, and the reason a naive voice loop fails in the field.

**The microphone reopens by itself after each answer.** A follow-up window
of twelve seconds, then sleep. An assistant that needs a tap between every
sentence is a button, not a conversation.

**Not streamed, unlike the chat on `os.html`.** The answer is spoken, not
read. Synthesis needs whole sentences, tool-use rounds cannot be streamed
cleanly, and a half-received thought must never be spoken as a fact. One
JSON answer, with the actions to run attached.

**The model proposes actions; the device performs them.** The function
sanitises every tool call, and the browser re-checks it against the same
list before executing. Nothing in that list can reach the network, the
filesystem or another origin: the worst a hijacked model response can do is
set a timer or open a page of this same site.

**Memory lives in the browser, never on a server.** Facts the operator
dictates go to `localStorage`, and are replayed into each request as fenced
reference data with angle brackets stripped — the same treatment the Monday
briefs get in `chat.mjs`. No transcript is stored anywhere, which is what
the OS page already promises publicly.

**The operator key travels in the URL fragment, never by voice.** A spoken
secret is not a secret, and the microphone is the one channel here. Opening
`/precious#k=<FOUNDER_KEY>` unlocks operator mode; the fragment is stripped
from the address bar immediately so it cannot be read over a shoulder or
captured in a screenshot.

**The site-wide `Permissions-Policy` disables the microphone.** It had to,
long before this page existed. `/precious` is now the single path that
re-enables it, and only for itself — never for an embedded frame. The page
also refuses to be framed at all.

## Trade-offs accepted

- **Chrome, Edge and Safari only.** The Web Speech API is not implemented in
  Firefox. The alternative — streaming audio to a server transcription API —
  costs money per second of silence, adds a round trip to every syllable and
  puts voice recordings on someone's infrastructure. Not worth it for a
  demonstration surface.
- **Browser voices are not the best voices available.** They are free,
  instant and offline. A neural voice endpoint would sound better and would
  add latency and cost to every sentence. Revisit only if PRECIOUS becomes a
  paid product rather than a proof.
- **A general-purpose assistant on a public page is a budget surface.** It
  is capped hard: six requests per minute per address, ninety per minute per
  instance, four hundred output tokens, ten turns of history, and
  `PRECIOUS_ENABLED=false` as a kill switch. The hard backstop stays the
  monthly spend limit in the Anthropic console.

## What would come next

Wake-word detection running locally rather than through the recogniser;
real barge-in with acoustic echo cancellation; the device actions extended
to the Hermes gateway so PRECIOUS can act on the repository and the
calendar rather than only on this browser.
