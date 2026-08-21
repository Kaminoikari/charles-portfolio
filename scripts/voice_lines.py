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
    ('mika-intro-1', 'はじめまして！あたしミカ！チャールズの作品集を案内する、エーアイアシスタントだよ。経歴でもプロジェクトでも、なんでも聞いてね！', 1.1),
]

# Laughter, shared verbatim by every locale — えへへ is the same sound in any
# language, so these keep their VOICEVOX originals and get no -zh/-en twins.
# avatarVoice.ts exempts the giggle cue from the per-locale suffix mapping.
GIGGLE_LINES = [
    ('mika-giggle-1', 'えへへ…', 1.0),
    ('mika-giggle-2', 'えへへっ', 1.0),
    ('mika-giggle-3', 'えへへへ…', 0.95),
]

# Taiwanese Mandarin, rewritten from the Japanese lines' JOB. A literal
# translation reads like a textbook, because the Japanese is gyaru shorthand.
# These keep the same beat in the register a Taiwanese speaker actually uses:
# sentence-final 喔／唷／啦／欸／齁 over 呢／吧, and 「Charles」, which is what her
# bubble already calls him (i18n/strings/zh-TW.ts).
#
# Kept short on purpose: these are interaction chrome, and the longest is the
# intro. Full-width punctuation throughout, per the project's writing rules.
ZH_LINES = [
    ('mika-greet-1-zh', '嗨嗨！關於 Charles 的事，什麼都可以問我喔！'),
    ('mika-greet-2-zh', '有叫我嗎？什麼問題我都答得出來唷！'),
    ('mika-greet-3-zh', '哈囉！今天想問什麼呀？'),
    ('mika-greet-4-zh', '來了來了！我等你好久了欸！'),
    ('mika-greet-5-zh', '講到 Charles，全世界就我最清楚啦！'),
    ('mika-greet-6-zh', '喔，你好奇齁？儘管問啦！'),
    ('mika-greet-7-zh', '歡迎歡迎！慢慢看，別客氣喔！'),
    ('mika-greet-8-zh', '想錄取他的話，要搶要快唷？'),
    ('mika-greet-9-zh', '我的聲音，很可愛對吧？'),
    ('mika-ack-1-zh', '好喔！稍等我一下下'),
    ('mika-ack-2-zh', '收到！等我一下下！'),
    ('mika-ack-3-zh', '這問題問得好！我馬上查！'),
    ('mika-ack-4-zh', '交給我！'),
    ('mika-ack-5-zh', '嗯，那個喔！我現在就回答！'),
    ('mika-full-1-zh', '鏘！我變大了！'),
    ('mika-full-2-zh', '好戲從現在才開始唷！'),
    ('mika-suggest-1-zh', '喔，你要問那個喔？'),
    ('mika-suggest-2-zh', '這個選得好欸！'),
    ('mika-bye-1-zh', '掰掰，下次見！'),
    ('mika-bye-2-zh', '隨時都可以叫我喔！'),
    ('mika-done-1-zh', '大概就是這樣，還可以嗎？'),
    ('mika-done-2-zh', '還想問什麼，儘管說喔！'),
    ('mika-error-1-zh', '欸？我好像出了點狀況，可以再試一次嗎？'),
    ('mika-intro-1-zh', '初次見面！我是 Mika 醬！我是帶你逛 Charles 作品集的 AI 助理喔。不管是經歷還是專案，什麼都可以問我！'),
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
    ('mika-intro-1-en2', "Nice to meet you! I'm Mika! I'm the AI assistant who shows you around Charles's portfolio. His background, his projects, ask me anything!"),
]

