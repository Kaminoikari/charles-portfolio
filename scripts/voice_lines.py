# Canonical text for every one of Mika's voice clips, in every locale.
#
# This table used to live inside gen_visemes.py, which worked while VOICEVOX
# synthesized all three locales: one engine produced the audio AND reported the
# mora timings the lip sync is baked from, so one script could own both. From
# 2026-08-21 the zh-TW and en clips are synthesized by fish.audio and then
# converted to her voice locally, which splits that job across three scripts.
# The text is the one thing all of them need, so the text moved here.
#
# Consumers (rename a key here and all three break):
#   scripts/gen_voice_fish.py    zh/en  -> synthesis with a native accent
#   scripts/gen_visemes.py       all    -> the generated viseme tracks
#   scripts/gen_voice_ref.py     ja     -> the seed-vc timbre reference, which
#                                          picks five JA_LINES keys by name
#
import re

# CLIP KEYS ARE CACHE KEYS. /avatar/* is served immutable, so changing what a
# clip SAYS means changing its key, not just its bytes (avatar-guide.md).

# Japanese, the original set. ja locale ships these; zh-TW used to borrow them
# for want of anything better, which is the gap this table exists to close.
# (key, text, speedScale used at synthesis)
JA_LINES = [
    ('mika-greet-1', 'はーい！チャールズのこと、なんでも聞いてね！', 1.0),
    ('mika-greet-2', '呼んだ？なんでも答えるよー！', 1.0),
    ('mika-greet-3', 'やっほー！今日はなに聞く？', 1.0),
    ('mika-greet-4', 'きたきた！待ってたよー！', 1.0),
    ('mika-greet-5', 'チャールズのこと、あたしが一番くわしいよ！', 1.0),
    ('mika-greet-6', 'おっ、気になる？なんでも聞いて！', 1.0),
    ('mika-greet-7', 'ようこそー！ゆっくりしてってね！', 1.0),
    ('mika-greet-8', '採用するなら早いもの勝ちだよ？', 1.0),
    ('mika-greet-9', 'あたしの声、かわいいでしょ？', 1.0),
    ('mika-ack-1', 'オッケー！ちょっと待っててね', 1.0),
    ('mika-ack-2', 'りょーかい！ちょい待ちね！', 1.0),
    ('mika-ack-3', 'いい質問！すぐ調べる！', 1.0),
    ('mika-ack-4', 'まかせて！', 1.0),
    ('mika-ack-5', 'ん、それね！いま答える！', 1.0),
    ('mika-full-1', 'じゃーん！おっきくなった！', 1.0),
    ('mika-full-2', 'ここからが本番だよ！', 1.0),
    ('mika-suggest-1', 'お、それ聞いちゃう？', 1.0),
    ('mika-suggest-2', 'ナイスチョイス！', 1.0),
    ('mika-bye-1', 'またねー！', 1.0),
    ('mika-bye-2', 'いつでも呼んでね！', 1.0),
    ('mika-done-1', 'こんな感じ！どう？', 1.0),
    ('mika-done-2', '他にも聞いてね！', 1.0),
    ('mika-error-1', 'あれ？ちょっと失敗しちゃった…もっかい試して？', 1.0),
    # Third head pat in a row. The first two earn a wordless giggle, which is
    # what lets that pool ship untranslated; this one is a LINE, so it is
    # localised like every other line. The owner asked on 2026-08-21 for the
    # annoyed beat to be audible, and a grunt shared across three locales would
    # have been the one place she speaks nobody's language.
    ('mika-huff-1', 'もー！さわりすぎだよ！', 1.0),
    ('mika-intro-1', 'はじめまして！あたしミカ！チャールズの作品集を案内する、エーアイアシスタントだよ。経歴でもプロジェクトでも、なんでも聞いてね！', 1.1),
]

# Laughter, shared verbatim by every locale — えへへ is the same sound in any
# language, so these keep their VOICEVOX originals and get no -zh2/-en2 twins.
# avatarVoice.ts exempts the giggle cue from the per-locale suffix mapping.
GIGGLE_LINES = [
    ('mika-giggle-1', 'えへへ…', 1.0),
    ('mika-giggle-2', 'えへへっ', 1.0),
    ('mika-giggle-3', 'えへへへ…', 0.95),
]

# Taiwanese Mandarin, rewritten from the Japanese lines' JOB. A literal
# translation reads like a textbook, because the Japanese is gyaru shorthand.
# These keep the same beat in the register a Taiwanese speaker actually uses:
# sentence-final 喔／喲／啦／欸／齁 over 呢／吧, and 「Charles」, which is what her
# bubble already calls him (i18n/strings/zh-TW.ts).
#
# Kept short on purpose: these are interaction chrome, and the longest is the
# intro. Full-width punctuation throughout, per the project's writing rules.
#
# The set is `-zh2`, and the `-zh` clips it replaces are gone. Two things were
# wrong with them, one in each stage of the pipeline:
#
#   Stage 2 shipped with `f0_condition=False`, so seed-vc regenerated pitch from
#   content plus a Japanese speaker embedding instead of following the source.
#   English survived that; Mandarin did not, because in Mandarin the pitch
#   contour IS the tone, so the syllables came out with the wrong tones and the
#   owner heard the whole set as foreign-accented. It hid from the obvious
#   measurement: sentence-level F0 correlation between the two stages stayed at
#   0.89, the same as English, because the damage is inside each syllable.
#   vc_to_tsumugi.py now passes `f0_condition=True`.
#
#   Six lines were also wrong as TEXT, which no amount of conversion fixes:
#   「唷」 came back sounding like 「噎」 in all three lines that used it (the one
#   character with a 3-of-3 failure rate across the batch), so greet-2, greet-8
#   and full-2 use 「喲」; and 「鏘」 was read qiāng when the beat wanted the
#   two-syllable ta-da, so full-1 says 「將將」.
#
#   Two more went a round further, on the owner's ear rather than on a defect
#   anyone could name from the text. greet-3 opened on 「哈囉」, two full-tone
#   syllables where the beat wants the shape of the English word, so it now
#   opens on 「Hello」 (gen_visemes_align.zh_vowels has the Latin fallback that
#   keeps her mouth moving through it). ack-1's 「喔」 landed as a stressed
#   fourth tone; the exclamation mark was what asked for the stress, and a full
#   stop is what finally read as the light final particle it is meant to be.
#   Candidates were synthesized and picked by listening, which is the only
#   instrument that settles this: the measurement preferred a different take.
#
# Re-synthesis was deliberately limited to the lines above. Stage 1 is
# stochastic (temperature 0.7) and the owner had already judged the remaining 19
# takes natural, so their fish.audio audio was carried over rather than rolled
# again — a re-roll can only lose a take that was already approved.
#
# Several lines were then re-cut on the owner's ear, one of them twice, so this
# set no longer shares one suffix: the keys below carry whichever generation
# each clip is on, and avatarVoice.ts's ZH_REGEN is the mapping that lets them
# differ. Read the table itself for the current spread — an earlier draft of
# this comment stated the tally and got it wrong, which is what writing the
# tally down buys you. Nothing forces a set to share one suffix, and forcing it
# would mean re-rolling approved takes.
#
#   suggest-1 had both of its 喔 wrong, in opposite directions: the opening one
#   was heard as 「嗚喔」, which is 喔 carrying wo1/wu1 as heteronyms beside its
#   default o1, and the owner wanted a plain rising 2nd tone. 哦 has no such
#   alternative reading. The closing one wanted the stressed 4th tone that
#   ack-1 was fixed by REMOVING last round, so it gets the exclamation mark
#   ack-1 gave up. The question mark is what makes the opening rise: measured
#   across 12 rolls it buys +9 to +15 semitones there, but it leaks that rise
#   into the sentence-final particle, so only 2 takes in 24 landed both tones.
#   The one that ships is the one the owner picked between those two.
#
#   intro-1 says 獎 where the character is 醬. This table is synthesis INPUT,
#   never displayed — the bubble copy in i18n/strings/zh-TW.ts is what a visitor
#   reads — and 醬 is jiang4 while the owner wants jiang3, so the homophone is
#   how the pronunciation is spelled. Do not "correct" this back to 醬 without
#   re-recording the clip. Charles was also not English enough; both were fixed
#   by the same take, which is why the line was not re-rolled for each.
#
#   bye-1 joined them afterwards. Its first 掰 was arriving as a fragment the
#   owner heard as 「阿掰」: the alignment gave it 0.08s against the second one's
#   0.48s. Eight re-rolls of the same words put it at 0.08s seven times and
#   0.16s once, so the compression is what the model does with that
#   reduplication rather than a bad draw, and 拜拜 behaved identically. Splitting
#   the pair with punctuation worked, but the owner rejected all three of those
#   takes and asked for English instead, which is the same move greet-3 made
#   when 「哈囉」 became 「Hello」.
#
#   intro-1 then went to a FOURTH generation without a single character
#   changing, which is why its line below is identical to what -zh3 shipped.
#   Two faults, both outside the wording:
#
#     Pitch. The owner heard the converted clip as too high, and it was: stage
#     2's auto_f0_adjust transposes every clip onto the REFERENCE median, so a
#     source that sat low gets over-lifted. This one came from 229Hz and landed
#     at 359Hz — above the reference itself (351Hz) and above a clip he had
#     already accepted (327Hz). The correction that ships for it is -1.5, which
#     puts it at 331Hz; it lives in PITCH_SHIFT below rather than in a flag, and
#     vc_to_tsumugi.py's --semi-tone-shift only overrides it.
#
#     Charles was not intelligible. The name got 0.24s here against 0.48s in
#     greet-5 and 0.32s in greet-1, both of which he accepted. Re-rolling the
#     unchanged sentence produced 0.40s, so the short one was the draw rather
#     than the sentence: 「Charles 作品集」 is not too crowded to say. Candidates
#     that padded the name (「Charles 的作品集」, a comma after it) and the
#     transliteration 查爾斯 were all synthesized and all passed over — 查爾斯
#     would also have been the only clip calling him something other than what
#     greet-1 and greet-5 call him.
ZH_LINES = [
    ('mika-greet-1-zh2', '嗨嗨！關於 Charles 的事，什麼都可以問我喔！'),
    ('mika-greet-2-zh2', '有叫我嗎？什麼問題我都答得出來喲！'),
    ('mika-greet-3-zh2', 'Hello！今天想問什麼呀？'),
    ('mika-greet-4-zh2', '來了來了！我等你好久了欸！'),
    ('mika-greet-5-zh2', '講到 Charles，全世界就我最清楚啦！'),
    ('mika-greet-6-zh2', '喔，你好奇齁？儘管問啦！'),
    ('mika-greet-7-zh2', '歡迎歡迎！慢慢看，別客氣喔！'),
    ('mika-greet-8-zh2', '想錄取他的話，要搶要快喲？'),
    ('mika-greet-9-zh2', '我的聲音，很可愛對吧？'),
    ('mika-ack-1-zh2', '好喔。稍等我一下下'),
    ('mika-ack-2-zh2', '收到！等我一下下！'),
    ('mika-ack-3-zh2', '這問題問得好！我馬上查！'),
    ('mika-ack-4-zh2', '交給我！'),
    ('mika-ack-5-zh2', '嗯，那個喔！我現在就回答！'),
    ('mika-full-1-zh2', '將將！我變大了！'),
    ('mika-full-2-zh2', '好戲從現在才開始喲！'),
    ('mika-suggest-1-zh3', '哦？你要問那個喔！'),
    ('mika-suggest-2-zh3', '這個選得好欸！'),
    ('mika-bye-1-zh3', 'Bye bye～，下次見！'),
    ('mika-bye-2-zh2', '隨時都可以叫我喔！'),
    ('mika-done-1-zh2', '大概就是這樣，還可以嗎？'),
    ('mika-done-2-zh2', '還想問什麼，儘管說喔！'),
    ('mika-error-1-zh2', '欸？我好像出了點狀況，可以再試一次嗎？'),
    ('mika-huff-1-zh2', '夠了啦！摸太多次了欸！'),
    ('mika-intro-1-zh4', '初次見面！我是 Mika 獎！我是帶你逛 Charles 作品集的 AI 助理喔。不管是經歷還是專案，什麼都可以問我！'),
]

# English. These REPLACE the カタカナ英語 set, which was Japanese phonetics
# wearing English words: all VOICEVOX could do with them, having no non-JA
# phonemes. The new clips are synthesized by a voice that speaks English
# natively and then converted to her timbre, so the accent is finally fluent
# while the voice stays hers.
#
# Written to be SPOKEN, not read: contractions throughout, no clause a person
# would have to re-read. Same beat as the Japanese, which is what keeps the
# 0.7-3.7s clip lengths and the interaction timing intact.
EN_LINES = [
    ('mika-greet-1-en2', "Hi hi! Ask me anything about Charles, okay?"),
    ('mika-greet-2-en2', "You called? I can answer anything!"),
    ('mika-greet-3-en2', "Yahoo! So, what are we asking today?"),
    ('mika-greet-4-en2', "There you are! I've been waiting!"),
    ('mika-greet-5-en2', "Nobody knows Charles better than me!"),
    ('mika-greet-6-en2', "Oh? Curious? Go on, ask me anything!"),
    ('mika-greet-7-en2', "Welcome! Make yourself at home!"),
    ('mika-greet-8-en2', "If you want to hire him, better be quick!"),
    ('mika-greet-9-en2', "My voice is cute, right?"),
    ('mika-ack-1-en2', "Okay! Just a second."),
    ('mika-ack-2-en2', "Roger that! Hang on!"),
    ('mika-ack-3-en2', "Ooh, good question! On it!"),
    ('mika-ack-4-en2', "Leave it to me!"),
    ('mika-ack-5-en2', "Mm, that one! Coming right up!"),
    ('mika-full-1-en2', "Ta-da! I got bigger!"),
    ('mika-full-2-en2', "Now the real show begins!"),
    ('mika-suggest-1-en2', "Ooh, going with that one?"),
    ('mika-suggest-2-en2', "Nice choice!"),
    ('mika-bye-1-en2', "See you later!"),
    ('mika-bye-2-en2', "Call me anytime, okay?"),
    ('mika-done-1-en2', "That's about it! How was that?"),
    ('mika-done-2-en2', "Ask me anything else, okay?"),
    ('mika-error-1-en2', "Huh? Something went wrong. Could you try again?"),
    ('mika-huff-1-en2', "Hey! That's enough already!"),
    ('mika-intro-1-en2', "Nice to meet you! I'm Mika! I'm the AI assistant who shows you around Charles's portfolio. His background, his projects, ask me anything!"),
]

# Stage-2 pitch correction, in semitones, applied AFTER seed-vc's
# auto_f0_adjust (scripts/vc_to_tsumugi.py reads this table).
#
# This is DATA rather than a flag someone remembers to type, because forgetting
# a flag fails silently. auto_f0_adjust transposes every clip onto the
# REFERENCE median, so a clip whose source sat low comes out over-lifted:
# intro-1 came from 229Hz and landed at 359Hz, above the reference itself
# (351Hz) and above a clip the owner had already accepted (327Hz). Re-running
# the batch without the correction puts it back at 359Hz while the viseme
# tracks, the catalogue and the file names all still agree — nothing goes red,
# and only the pitch is wrong.
#
# Keyed by clip name and LOCALE but without the generation number, which is
# the second half of the same problem. `mika-intro-1-zh4` would stop matching
# the day intro-1 is re-cut as -zh5, and `.get()` would quietly hand back 0.0
# for exactly the clip that needs the correction. Dropping the locale too would
# break it the other way: `mika-intro-1` also prefixes the English and Japanese
# recordings of that line, which come from different sources at different
# pitches and must not inherit this. `mika-intro-1-zh` survives re-cuts and
# still names one recording; the assert below refuses a name matching none.
#
# A clip absent from here gets no correction, which is the right default —
# most sources land close enough to the reference to need nothing.
#
# Defined at the end of the file because the guard below reads every LINES
# table, and only zh/en clips ever reach the lookup: the ja set is VOICEVOX
# output that never goes through voice conversion.
PITCH_SHIFT = {
    'mika-intro-1-zh': -1.5,
}

# Every clip key reduces to a base name, so the guard covers all three locales
# even though only zh-TW needs a correction today. A typo here would otherwise
# be the third silent failure in the same place: `.get()` hands back 0.0 for a
# name nothing matches, and no output looks wrong until someone listens.
_CLIP_BASES = {
    re.sub(r'(-(?:zh|en))\d*$', r'\1', key)
    for key, *_ in (*JA_LINES, *GIGGLE_LINES, *ZH_LINES, *EN_LINES)
}
assert set(PITCH_SHIFT) <= _CLIP_BASES, (
    f'PITCH_SHIFT names clips that do not exist: '
    f'{sorted(set(PITCH_SHIFT) - _CLIP_BASES)}'
)
