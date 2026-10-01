# RAG Ablation Report

Retrieval-ablation results from the golden set, run against the live Qdrant index
via the `RAG Eval` workflow. Each arm adds one retrieval layer, so the marginal
lift of each is visible.

- Golden set: **48 questions × 3 locales** (en / zh-TW / ja) = 144 query runs,
  across seven categories (single-fact, global, local, near-miss, out-of-corpus,
  comparison, temporal). The last two were added 2026-10-01 because the set had
  saturated: every arm scored near 100% on the five older categories, so it
  could no longer tell a better pipeline from a worse one.
- `recall@k` is hit-rate: did a relevant chunk surface in the top-k? A
  comparison or temporal item names every chunk it needs (`needsEvery`) and
  scores the share of them retrieved, so finding one side of a comparison is
  half credit. An item may also name one chunk that answers it whole
  (`answeredBy`, so far only the experience timeline): retrieving it scores
  full recall. `MRR` is the reciprocal rank of the first relevant chunk.
- recall and MRR average only the runs that retrieved. A FAQ hit or a canned
  reply never reaches retrieval and is counted in the "answered without
  retrieval" column; before 2026-10-01 those runs were scored as recall misses.
- The `corrective` arm runs the full graph and scores `correctness` and
  `faithfulness` too. It needs an Anthropic key, so it is skipped in the
  post-ingest gate, which has only the retrieval secrets.
- Last run: **2026-10-01**, after the experience timeline chunk was added.
  The four retrieval arms are from run 36868407205 (commit cdf7b6f). The
  `corrective` row is from run 36871169321 (commit 7281602); the two commits
  differ only in the faithfulness judge, which the retrieval arms never call,
  and in the committed recall baseline, which no eval run reads.
  Both runs query `doc_chunks_timeline`, an index built from the same branch.

## Current results

| Arm | recall@k | MRR | correctness | faithfulness | answered without retrieval |
|---|---|---|---|---|---|
| sparse-only | 77.4% | 0.506 | — | — | 0 of 144 |
| dense-only | 96.9% | 0.736 | — | — | 0 of 144 |
| hybrid | 92.7% | 0.656 | — | — | 0 of 144 |
| hybrid+rerank | 97.2% | 0.856 | — | — | 0 of 144 |
| corrective | 96.7% | 0.838 | 99.3% | 91.0% | 22 of 144 |

Recall by category (n = query runs):

| Arm | single-fact (66) | global (18) | local (15) | near-miss (12) | out-of-corpus (12) | comparison (9) | temporal (12) |
|---|---|---|---|---|---|---|---|
| sparse-only | 77.3% | 44.4% | 100.0% | 100.0% | 100.0% | 61.1% | 66.7% |
| dense-only | 97.0% | 94.4% | 100.0% | 100.0% | 100.0% | 83.3% | 100.0% |
| hybrid | 97.0% | 66.7% | 100.0% | 100.0% | 100.0% | 72.2% | 100.0% |
| hybrid+rerank | 100.0% | 94.4% | 100.0% | 100.0% | 100.0% | 66.7% | 100.0% |

**The timeline closed the temporal gap.** Before it, every experience chunk
carried its own dates and nothing said where it fell, so "what was his first
role" retrieved changelog entries in every locale and temporal recall for
hybrid+rerank was 41.7% (run 36809275348). One chunk per locale now lists the
roles by start date and names the earliest and the current ones
(`rag/ingest/extract.ts` timelineChunk). Against the committed per-question
baseline, hybrid+rerank dropped no question and raised nine (run 36867760929):
`first-role` in all three locales because the timeline is now retrieved, and
`before-pxpay` and `concurrent-roles` in all three because the timeline answers
them whole. The baseline was refreshed to that run.

The arms nobody is served lost a little: dense-only single-fact 98.5% to
97.0% and global 100.0% to 94.4%, hybrid single-fact 98.5% to 97.0% and global
72.2% to 66.7%. The served arm, hybrid+rerank, kept 100.0% and 94.4% on those.

**sparse-only is what a visitor gets while Voyage is down.** Before 2026-10-01
a Voyage outage ended the request with the outage notice (or, when the network
call itself failed, a generic stream error); now retrieve falls back
to the BM25 half of the hybrid query and reports `dense-unavailable`. It costs
19.8 points of recall against hybrid+rerank (77.4% against 97.2%) and most of
the ranking (MRR 0.506 against 0.856). The loss is concentrated where the
question shares few words with the answer: global questions drop to 44.4%. A
question that names its subject (local, near-miss) loses nothing.

**Comparison is now the category that can fail.** At 66.7% it is one item
scoring zero in all three locales: `compare-path-plutus-stack` retrieves each
project's solution chunk and changelog entries about the project pages, and
neither tech chunk that lists the stacks. dense-only scores higher on this
category (83.3%); why has not been measured.

**corrective: 99.3% correct (1 of 144 wrong), 91.0% faithful (11 of 122 judged
runs ungrounded).** The one wrong answer is `ai-workflow` (ja), where the judge
found the rule's claim not stated; the answer text is not in the log. Before
the timeline (run 36857502362, 15424ba) the arm scored 97.2% correct, and three
of its four wrong answers were `first-role`.

The faithfulness judge now gets today's date and a rule that a translation or
an equivalent number counts as supported, both aimed at misreads in run
36857502362. Neither had an effect that one run can show: the rate is the same
91.0%, `concurrent-roles` (en) is no longer called a future date, but
`uspace-role` (zh-TW) is, in a run where the judge was told the date. A
variant that asked the judge to list every unsupported claim (run 36868407205)
read 76.2%, with ungrounded verdicts rising from 11 to 29 on wording it
disliked, and was reverted.

Of the eleven ungrounded answers in run 36871169321:

- Judge misreads (6), where the context states the claim or the judge's own
  reason contradicts its verdict: `uspace-role` (zh-TW) calls August
  2026 a future date while quoting today as October 1, 2026; `plutus-frontend`
  (zh-TW) rejects "the frontend is on Vercel" in a reason that says the context
  puts the frontend on Vercel; `before-pxpay` (zh-TW) says "the value is
  correct"; `first-role` (ja) says the revenue figure "is correct" and then
  calls "+20% market share" ambiguous; `cs153-scale` (zh-TW) rejects "ChatGPT
  的共同創造者 Liam Fedis", which the blog body states word for word;
  `uber-blog` (ja) rejects "a high-level customer-service analyst", a
  translation of the blog's 「高級版的客服營運分析師」 (its second complaint,
  about decision-making authority, cannot be checked from the log).
- Not decidable from the log (5): `jobops-source` (en), `playbook-frameworks`
  (en, ja), `plutus-frontend` (ja), `shazam-author` (ja). The reasons describe a
  version or attribution mismatch without quoting enough of the answer to tell.

A judge that cannot be read no longer ends the eval: run 36867749603 stopped at
the first verdict the parser rejected and lost every result after it. The same
failure now costs one item, printed as unjudged.

## Previous run (2026-09-16, 41-question set)

Historical: every figure in this section was measured on the 41-question set
with the FAQ cache at 0.7 / 0.02, and FAQ hits scored as recall misses. It is
not comparable to the table above. Kept because it records how the faithfulness
measurement and the near-miss rules were fixed.

| Arm | recall@k | MRR | correctness | faithfulness |
|---|---|---|---|---|
| dense-only | 97.6% | 0.821 | — | — |
| hybrid | 92.7% | 0.649 | — | — |
| hybrid+rerank | 96.7% | 0.873 | — | — |
| corrective | 80.5% | 0.724 | 100.0% | 95.6% |

Recall stopped being 100% when the set grew from 29 to 41 questions, which is
the point of having grown it: the old set could not fail. The added items are
blog-body questions, agentic-pattern questions (22 chunks that had no coverage
at all), and four near-miss pairs.

**The corrective arm's 80.5% recall is not a retrieval result.** The FAQ cache
answered 23 of its 123 runs, and a cached answer carries no retrieved sources,
which the harness scores as a recall miss. 80.5% + 18.7% = 99.2%, in line with
`hybrid+rerank`'s 96.7% (slightly above it because the corrective loop's rewrite
recovers a few). The metric could not separate "the cache answered" from
"retrieval found nothing" at the time; the "answered without retrieval" column
added on 2026-10-01 does.

**Faithfulness is now measured over the 91 runs a judge could actually read, and
it took two fixes to mean anything.** Three figures, none of them comparable to
the next, and the reason each moved is the measurement rather than the answers:

| Run | Reported | Measured over |
|---|---|---|
| 35110389098 | 85.4% | all 123 runs, with every unjudgeable one scored as a pass |
| 35122775710 | 82.4% | the 91 runs with retrieved context, judged against the chunks alone |
| 35124733398 | 95.6% | the same 91 runs, judged against everything the generator was given |

The first was inflated by its own denominator. A FAQ cache hit, a canned decline
and an outage notice reach the visitor with no retrieved context, and the judge
called that vacuously faithful and returned a pass. So the headline rose with the
cache hit rate: the lexical veto sent five more questions to generation, the free
passes fell from 28 to 23, and the number dropped without an answer changing.
Those runs are absent from the mean now, the same way a retrieval arm's
correctness is absent.

The second was the honest denominator over the wrong evidence, and it is the one
worth reading twice. Sixteen answers came back ungrounded, and the judge was
right about what it saw: it named PXPay Plus, NUEIP, FLUX, Plutus Trade and
every metric it could not find. All of them are in `rag/portfolio-map.ts`, which
the generator is given and the judge was not. The pipeline grounds a claim in
three things, the numbered chunks, the portfolio map and the entity
relationships, and only the first carries a citation number, so the other two are
the two that get forgotten. They were forgotten here for the same reason the bot
once cited `[Charles Chen description]`: each reader built its own list.
`evidenceBlock` in `rag/nodes.ts` is that list now, and the prompt, the link
filter and the judge all read it.

Four ungrounded answers are left, which is what 95.6% is. One of them is the
judge arguing with itself: it quotes the answer and the context saying the same
words and calls the answer unsupported. That one is worth a look anyway, because
the words it quotes are 「ChatGPT 的共同創造者 Liam Fedis」, and the name is
misspelled in the source article, so the bot repeats it faithfully.

### By category

`recall` (hybrid+rerank) and `correctness` (corrective):

| Category | n | recall | correctness |
|---|---|---|---|
| single-fact | 66 | 95.5% | 100.0% |
| global | 18 | 94.4% | 100.0% |
| local | 15 | 100.0% | 100.0% |
| near-miss | 12 | 100.0% | 100.0% |
| out-of-corpus | 12 | 100.0% | 100.0% |

Read near-miss in the correctness column, not recall. A near-miss item's sibling
chunk is one of its own relevant ids, so retrieving the wrong one of the pair
scores full recall while the answer quotes the other company's number — which is
why recall reads 100% there and cannot be read as reassurance.

`local` and `global` correctness read 66.7% and 77.8% before the rules were
fixed. Nine of the sixteen misses in that run were the metric: `mustInclude` is
a substring check, and the site's zh/ja copy keeps English terms inline
(「重成果，不重產出 (Outcomes over outputs)」), so the rule quietly required the
generator to carry the parenthetical through. Those facts moved to `mustState`,
judged by meaning in any language, and both categories went to 100%.

### The four misses, and what closed them

Correctness read 96.7% with four misses. All four were one symptom, **the FAQ
cache serving a broad entry for a specific question**, and they turned out to
have two different causes.

| Item | Locale | Served | Should have served | Closed by |
|---|---|---|---|---|
| `nueip-role` | zh-TW | `overall-summary` | `exp-nueip` | the lexical veto |
| `skills-listed` | en, zh-TW, ja | `why-hire` | the skills chunk | the chunk heading |

Both were verified against production first: the answer to "what skills does
Charles list on his site?" was byte-identical to the `why-hire` entry, a hiring
pitch that never lists a skill; the answer to 「Charles 在 NUEIP 做什麼?」 ran 626
characters without naming NUEIP once. The English NUEIP question was fine, so it
was the zh embedding neighbourhood that ranked the broad entry first.

The margin rule does not catch either. It refuses a top hit that fails to beat
the best DIFFERENT entry by `RAG_FAQ_MARGIN`, and here the broad entry won
comfortably. Being confidently wrong is the case it was never designed to see.

**The lexical veto** (`RAG_FAQ_SPARSE_VETO`, default on since 9fa5756) is the
second opinion that does see it. The FAQ collection carries a `qdrant/bm25`
sparse vector beside its dense one, and a dense winner the lexical arm does not
rank at all is refused and falls through to RAG. It fired 5 times in 123 runs
and closed `nueip-role`. IDF is the reason it works where another embedding
would not: a dense vector scores the FRAME of 「Charles 在 NUEIP 做什麼?」, which
is nearly the frame of 「Charles 是做什麼的」, while BM25 weights the one rare
proper noun that tells the two apart.

**`skills-listed` was never a cache problem.** The veto did refuse `why-hire`
on the en run, and the answer was still wrong, because retrieval had nothing to
offer either: the skills chunk held the bare list of labels
("GPS for chaos", "Talking to humans, professionally") with no word saying what
the list was, so no phrasing of "what skills does he list" matched it. Giving
the chunk a per-locale heading (`SKILLS_HEADING` in `rag/ingest/extract.ts`,
ca3e211) made it the top source, and the three misses went with it.

## How two earlier changes moved the numbers (2026-06, 29-question set)

Historical: every figure in this section was measured on the 29-question set
against the corpus as it stood in June, so it is not comparable to the table
above. Kept because it records why `RAG_FIRST_PARTY_BOOST` is 1.2.

Indexing the full blog bodies let the bot answer body-only questions (e.g.
"Why did Charles turn down the Uber offer?"), but the 900-char body chunks then
out-ranked first-party `about:*` chunks on a couple of cross-corpus synthesis
questions. Two changes resolved that without losing the new blog coverage:

1. **Widen the synthesis golden items** to their real evidence set — for global
   questions like "how does Charles use AI across his work?", the articles where
   he actually builds with AI (and his product-method project) are legitimate
   evidence, not only the `about` chunk.
2. **Weight first-party content above blog bodies** (`RAG_FIRST_PARTY_BOOST`) so
   curated portfolio sources outrank tangential blog bodies on the same topic.

Progression on `hybrid+rerank`:

| Stage | recall@k | MRR |
|---|---|---|
| blog bodies indexed, strict golden | 96.6% | 0.817 |
| + widened synthesis golden | 100.0% | 0.854 |
| + first-party weighting (1.2) | 100.0% | 0.880 |

Recall held at 100% through the weighting change and no blog-only question
regressed (the Uber / LangGraph body questions, which have no first-party
counterpart, stayed in the top-k), while MRR rose as first-party content
returned to the front.

## Reproducing

```
gh workflow run "RAG Eval" --ref main      # all five arms, all three locales
gh workflow run "RAG Eval" --ref <branch> -f ref=<branch>   # a branch: the
                                           # job checks out the `ref` input,
                                           # which defaults to main
gh run view <run-id> --log                 # the three tables + per-item misses
```

Locally (needs `VOYAGE_API_KEY` + `QDRANT_URL` + `QDRANT_API_KEY`):

```
npm run rag:eval                 # all retrieval arms, all locales
npm run rag:eval -- --arm hybrid+rerank --locale en
```
