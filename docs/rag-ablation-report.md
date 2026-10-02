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
- Last run: **2026-10-02**, on the production `doc_chunks` index at commit
  2a9b931, after the product philosophy got an overview chunk and two golden
  claims were narrowed. The four retrieval arms are from run 36964683250 and
  the `corrective` row from run 36963114882. Judges run on Sonnet 4.6 since
  92aded5. The corpus fixes in d993a2b came later and have only partial runs;
  see "Corpus fixes for repeated ungrounded verdicts" below.

## Current results

| Arm | recall@k | MRR | correctness | faithfulness | answered without retrieval |
|---|---|---|---|---|---|
| sparse-only | 83.7% | 0.618 | — | — | 0 of 144 |
| dense-only | 98.3% | 0.760 | — | — | 0 of 144 |
| hybrid | 97.9% | 0.738 | — | — | 0 of 144 |
| hybrid+rerank | 100.0% | 0.861 | — | — | 0 of 144 |
| corrective | 100.0% | 0.845 | 100.0% | 91.8% | 22 of 144 |

Recall by category (n = query runs):

| Arm | single-fact (66) | global (18) | local (15) | near-miss (12) | out-of-corpus (12) | comparison (9) | temporal (12) |
|---|---|---|---|---|---|---|---|
| sparse-only | 81.8% | 77.8% | 100.0% | 83.3% | 100.0% | 66.7% | 79.2% |
| dense-only | 97.0% | 100.0% | 100.0% | 100.0% | 100.0% | 94.4% | 100.0% |
| hybrid | 98.5% | 94.4% | 100.0% | 100.0% | 100.0% | 88.9% | 100.0% |
| hybrid+rerank | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% |

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

On the experiment index the timeline cost the arms nobody is served a little:
dense-only single-fact 98.5% to 97.0% and global 100.0% to 94.4%, hybrid
single-fact 98.5% to 97.0% and global 72.2% to 66.7% (run 36868407205). With
the AI overview chunk below, global is back to 100.0% and 72.2% on production;
single-fact stays at 97.0%.

**`ai-workflow` (ja) failed the production gate; dense-only and hybrid+rerank
now retrieve it in every locale.** When the timeline went live (86e6ae2), the
post-ingest gate went red on one question: `ai-workflow` in Japanese, which the baseline had as
a hit (run 36874601695). The "How I Use AI" table was indexed as seven rows,
each answering one narrow part (spec writing, agentic workflows, …), and none
of the seven Japanese rows names Charles. BM25 barely splits Japanese, so only
the dense half could find them, and no single row was close enough: in Japanese, sparse-only, dense-only
and hybrid all missed it (run 36868407205). hybrid+rerank hit only when a row happened to fall inside
the 20 candidates it reranks, which is why the experiment index passed the
same code and production did not. Prefixing every row with the section heading
(871d3a9) did not help: hybrid+rerank still missed it in Japanese
(run 36887255550). What did is one more chunk per locale holding the whole
table under the site's own heading (`about:ai:overview:<locale>`, in
`aboutChunks`). On production, dense-only and hybrid+rerank then hit
`ai-workflow` in all three locales, the gate passed with no question below its
baseline (run 36889248688), and the corrective arm answered it correctly in
Japanese. sparse-only and hybrid still missed it in zh-TW and ja until BM25
could segment those languages (next section); since 92aded5 every arm hits it
in every locale (run 36906401188).

**BM25 now segments Chinese and Japanese.** Its default `word` tokenizer
splits on spaces and punctuation, so a CJK sentence reached the index as a few
long tokens that no question repeats, and the sparse arm could match only the
Latin words in it. zh-TW and ja now ask Qdrant for the `multilingual`
tokenizer, on ingest and on the query alike (`rag/qdrant.ts` chunkSparse), and
the option is part of each chunk's hash, so the change rebuilt the CJK points
and left the English ones alone. Segmenting alone made things worse: every
particle and question word became a token, and sparse-only fell to 70.1% with
hybrid+rerank losing `nueip-role` (zh-TW) on the experiment index (run
36894380554). The built-in Chinese and Japanese stopword lists stopped the
particles but not the question words. Probing one word at a time showed why a
first custom list did nothing: Traditional Chinese is segmented one character
at a time, so an entry like 什麼 never matches a token (run 36896446685). The
list that works names single tokens (什, 麼, 做, まし, でし, くらい and other
interrogatives); the six named here were probed and do stop (run
36896974338). Against production before the change (run 36889761728),
sparse-only rose from 72.2% to 76.7% and hybrid from 93.4% to 95.1%;
hybrid+rerank kept 97.2% with no question below its baseline (run 36905891432)
and its MRR moved from 0.853 to 0.836.

**sparse-only is what a visitor gets while Voyage is down.** Before 2026-10-01
a Voyage outage ended the request with the outage notice (or, when the network
call itself failed, a generic stream error); now retrieve falls back
to the BM25 half of the hybrid query and reports `dense-unavailable`. It costs
20.5 points of recall against hybrid+rerank (76.7% against 97.2%) and most of
the ranking (MRR 0.567 against 0.836). The loss is concentrated where the
question shares few words with the answer: global questions drop to 66.7%.
Questions that name their subject lose less (local 93.3%, near-miss 83.3%).
The same code reads differently on two indexes built from the same branch
(77.4% on the experiment index, run 36902404670); why has not been measured.

**rerank-3 was tried and not adopted (2026-10-02).** Voyage released it on
2026-09-30 as a drop-in upgrade to rerank-2.5 at the same price. With only the
model name changed, hybrid+rerank on production read 96.5% recall and MRR 0.828
against rerank-2.5's 97.2% and 0.836, in two identical runs (36952253044,
36952258587): one question fell below its baseline (`overall-style`, ja), none
rose, and `degraded` was 0 of 144, so every rerank call went to the new model.
Voyage's published gains are largest on long documents and code, which this
corpus has little of. Worth re-measuring when the corpus or rerank-2.5's
availability changes.

**The tech-stack chunks name their project (b4844cb).** `compare-path-plutus-stack`
scored zero in all three locales: asked how Path's and Plutus Trade's stacks
differ, retrieval returned the changelog entry "Product Pages — Tech Stack
Refresh", which names both projects and says tech stack, and neither stack
table. Each table was the rows alone ("Frontend Framework: React 18, …"); the
project's name and the words tech stack were only in its title, which is
neither embedded nor indexed by BM25. Each tech chunk now opens with its
title. On production (run 36954509072) hybrid+rerank went from 97.2% to 99.3%
and comparison from 66.7% to 100%, every arm rose (sparse-only 76.7% to 82.3%,
dense-only 97.6% to 98.3%, hybrid 95.1% to 95.8%), and the baseline was raised
to the run where the item is found, so the gate now holds it (run 36954279258,
no question below the new baseline). rerank-3 had not recovered this item
either. The one hybrid+rerank miss left after it was `overall-style` (zh-TW),
closed by the philosophy overview below.

Forty-five more project chunks have the same gap: the problem, impact and
learnings sections of every project carry the project's name only in their
title (the solution sections happen to name it in the text). No golden
question currently fails because of them; they have not been changed.

**corrective: 97.9% correct (3 of 144 wrong), 93.4% faithful (8 of 122 judged
runs ungrounded).** Both judges now run on Sonnet 4.6 (`config.modelJudge`);
before 92aded5 they ran on Haiku, so these numbers are not comparable with the
runs below. The three wrong answers (`pattern-rag` in zh-TW and ja,
`uspace-role` in ja) are all `claim not stated`: the stronger judge asks for
every part of a golden claim, for instance the 15-person team in
`uspace-role`, where Haiku let a partial answer through. The golden claims
were not loosened.

Three causes of ungrounded verdicts were fixed. The judge was shown the
retrieved chunks but not the contact channels written into the generation
prompt, so every answer that listed them was called invented; generation and
the judge now read one `answerContext` (`rag/nodes.ts`). The About page still
described Product Playbook v1.x ("22 frameworks") while the project page and
the portfolio map describe 2.0's 16 lenses, so answers carried both numbers;
the About copy and the golden `playbook-frameworks` now say 16. And Haiku's
misreads (a reason that quotes the supporting line and still says
unsupported) stopped with the model change. In the last Haiku run on
production (run 36889773317) the arm read 99.3% correct and 88.5% faithful.

The eight ungrounded verdicts left, by the judge's own reasons: three answers
join facts the context keeps apart (a 22-to-16 narrowing it never states,
market figures listed as quant features, a pre-mortem statistic read
backwards); two miscount or mislabel a list (the number of skills, the three
core product lines); two attribute a fact to the wrong source (`shazam-author`
and `before-pxpay`, both zh-TW); one renders a term wrongly (`shazam-author`,
ja). These reasons were not each checked against the context.

`compare-team-sizes` (ja) was wrong in run 36889773317 and again in run
36951385380, after twenty correct single-item reruns and three correct full
runs. The second time the eval printed the answer: it gives the FLUX team as
10 and says the USPACE Scrum team's size is not on record, citing the current
six-person team instead. The USPACE chunk was among the sources (comparison
recall was 100% for this item) and states 「15 名のクロスファンクショナル
Scrum チーム」 in full, 647 characters in, with nothing truncated on the way to
the prompt. So the generator was given the number and missed it. The eval
generates with Haiku (`RAG_FORCE_CLAUDE`), while visitors get Gemini, so this
rate says nothing direct about what visitors see.

In the latest run (36954515395, b4844cb) the arm read 99.3% correct, the one
wrong answer being `pattern-rag` (ja) again judged `claim not stated`, and
90.2% faithful (12 of 122).

Run 36951385380 also shows how much a single run moves. After the two golden
claims were narrowed to what their questions ask (15986e4), it read 97.9%
correct and 88.5% faithful (14 of 122), against 97.9% and 93.4% (8 of 122) in
run 36906411274 the day before. The wrong answers were different ones
(`overall-style` zh-TW, `skills-listed` ja, `compare-team-sizes` ja), so the
narrowing removed the three it targeted and three others failed. Differences
of a few points between two corrective runs are within this spread.

**The product philosophy has an overview chunk (66ef53d).** "What is his
overall product philosophy" was the last question hybrid+rerank missed
(`overall-style`, zh-TW). Each philosophy bullet was its own chunk, each
answers one part of the question, and none says 產品哲學. The bullets now also
get one chunk headed by the site's own section heading and intro
(`about:philosophy:overview:<locale>`), the same fix the AI table got. In run
36958623992 every one of the 144 questions scored 1, and the baseline was
raised to that run (080e730). On the current index (run 36964683250)
hybrid+rerank reads 100.0% and the global category rose for every arm
below 100% (sparse-only 66.7% to 77.8%, hybrid 77.8% to 94.4%, hybrid+rerank 94.4% to
100%).

**corrective: 100% correct in three consecutive full runs.** Runs
36963114882, 36963118089 and 36963121030 (2a9b931) each read 144 of 144
correct, with faithfulness 91.8%, 88.5% and 89.3% (10, 14 and 13 of 122 judged
runs ungrounded). Getting there took two changes. The eval now prints the
claim judge's reason beside a wrong verdict (787bf3e), since the answer excerpt
alone did not show whether the answer left the fact out or the claim asked for
more than the question. With the reasons printed, every remaining miss was a
correct answer failed on wording:

- `pattern-rag` failed first for not saying the documents are ones the model
  never trained on, which is why RAG exists (69157ca), then in English for not
  using the claim's phrase "along with the question", then once for quoting
  the pattern's own definition ("ground answers in external, up-to-date, or
  proprietary data") without walking through the steps. The claim now asks for
  what both of his descriptions share: the answer rests on external data given
  to the model.
- `skills-listed` (zh-TW) quoted the site's entries under headings and was
  failed for the claim's "a long set of short labels" shape, and for missing a
  data area while quoting 把試算表變成決策. The claim now asks that the listed
  skills span product work and building with AI.

Before the three full runs, nine single-item runs of `pattern-rag` (three per
locale) and three of `skills-listed` (zh-TW) were all correct. Each claim
change carries a comment in `rag/evals/golden.ts` citing the runs that showed
it. Ungrounded verdicts still move by a few points between runs with no code
change; the reasons in these runs are the same kinds listed above (a skills
count, three core product lines, 22 frameworks read as narrowed to 16).

**Corpus fixes for repeated ungrounded verdicts (59ba850, d993a2b), measured
only in part.** Of the 37 ungrounded verdicts in the three full runs above,
24 fell in six groups that recurred across runs and locales, and each traced
back to the corpus:

- `playbook-frameworks` (6): answers said 2.0 narrowed 1.x's 22 frameworks to
  16 lenses. That is true (Product Playbook's own design doc lists the
  merges), but no page said it. The project page now does, in three locales.
- the pre-mortem figure (4, `ai-workflow` and `pattern-reflection`): the
  portfolio map split "pre-mortem alone 100%->22.2% when removed" across a
  line break, so it read as pre-mortem causing the drop. It now says removing
  pre-mortem dropped the risk step from 100% to 22.2%.
- `houseops-decide` (4): the page said weights swap per persona and never
  named the three bands, so answers borrowed Job Ops's labels and invented
  per-persona weights. The pipeline has a renting set and a buying set
  (`scripts/eval-591.mjs` and its README); the page now gives both sets and
  the band thresholds (4.0 and above, 3.5 to 3.9, below 3.5).
- `langgraph-blog` (4): reciprocal rank fusion, true of this system but absent
  from the context the judge sees, and the blog's 755 paraphrases read as 755
  answers. Not changed.
- `uspace-role` (3): the English experience bullet folded two core product
  lines into "corporate travel and insurance". It now lists them as the
  zh-TW and ja bullets do.
- `skills-listed` (3): answers counted 24 of 29 skills. The skills chunk's
  heading line now states the count, taken from the list it prints.

Ingest rebuilt 10 chunks and the post-ingest gate read hybrid+rerank 100.0%,
MRR 0.863 (run 36967623212). The three full corrective runs that followed
(36967984519, 36967987379, 36967990094) stopped about 13 minutes into a
roughly 20-minute run when the Anthropic account ran out of credit, so none
produced a summary table and there is no faithfulness percentage. The eval
loops over locales in the order en, zh-TW, ja, and only one ja item shows up
in their logs, so the comparison below covers en and zh-TW, inferred from the
timing to be complete:

| en + zh-TW, three runs | before (runs above) | after (partial runs) |
|---|---|---|
| ungrounded verdicts | 29 | 20 |
| wrong answers | 0 | 4 |

In en and zh-TW, none of the targeted misreadings recurred (22-to-16 as unstated, invented
persona weights or borrowed band labels, the pre-mortem direction, the USPACE
lines, the skills count). Four of the 24 were in ja (two on the pre-mortem
direction, one `houseops-decide`, one `playbook-frameworks`), which these runs
did not reach, so the fixes are unmeasured there. Six verdicts remain in those groups in other forms:
three `playbook-frameworks` (zh-TW) attribute 1.x's research or category
breakdown to 2.0, one `houseops-decide`, one `uspace-role` on the promotion
date, one `pattern-reflection` on a citation index. `langgraph-blog` (en)
still names reciprocal rank fusion in all three.

The four wrong answers are a regression on the earlier 144 of 144:
`pattern-rag` (zh-TW) in all three runs, judged as never stating that the
answer rests on external data while describing the embed, retrieve and
prompt pipeline, and `nueip-role` (zh-TW) once, for not naming NUEIP. The
pattern-rag claim's third wording passed nine single-item runs, three of
them zh-TW, so it is not yet stable for that locale.

**The Anthropic backstop answers with Haiku (5e59941).** After the credit ran
out, `modelStrong` defaults to Haiku: visitors' broad questions took Sonnet
only when Gemini gave no first token. The eval's generation follows the same
setting while its judges stay on Sonnet, so from here broad items are
generated by Haiku, and corrective numbers before and after 5e59941 are not
directly comparable. Until the account is topped up, the
Claude backstop in production fails as well.

The faithfulness judge now gets today's date and a rule that a translation or
an equivalent number counts as supported, both aimed at misreads in run
36857502362. Neither had an effect that one run can show: run 36871169321 read
the same 91.0%, `concurrent-roles` (en) is no longer called a future date, but
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
