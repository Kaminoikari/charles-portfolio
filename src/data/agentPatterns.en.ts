// Charles's working reference on agentic design patterns. This is a curated
// knowledge source for the portfolio chatbot, not visible site UI: it lets the
// bot answer "does Charles know agentic design patterns / how does he apply X"
// from his real engineering practice. Every `howCharles` note is grounded in a
// system he has actually shipped (this corrective-RAG chatbot, the Product
// Playbook multi-agent system, his Claude Code / Codex builder workflows) or
// stated in measured terms where the tie is genuine but lighter, never invented.
//
// Pattern set and definitions follow Antonio Gulli's "Agentic Design Patterns"
// (the 21 core chapters). `name` keeps the English term across all locales;
// `body` is localized per file. The RAG ingest emits one chunk per pattern.

export interface AgentPattern {
  id: string
  name: string
  chapter: number
  body: string
}

// One-paragraph intro that frames the whole set as Charles's expertise.
export const agentPatternsIntro =
  'Agentic design patterns are the reusable building blocks Charles draws on as an AI Product Builder. ' +
  'These notes are his working reference, grounded in systems he has actually shipped, including this ' +
  'corrective-RAG chatbot and his Product Playbook multi-agent system. Each pattern covers what it is, ' +
  'when to reach for it, and how he applies it in practice.'

export const agentPatterns: AgentPattern[] = [
  {
    id: 'prompt-chaining',
    name: 'Prompt Chaining',
    chapter: 1,
    body: 'Break a task too big for one prompt into a sequence of steps, where each step\'s output feeds the next and state carries through. Charles uses it in Product Playbook, which chains discovery, strategy, and spec stages into one pipeline that turns a fuzzy idea into an executable PRD.',
  },
  {
    id: 'routing',
    name: 'Routing',
    chapter: 2,
    body: 'Have the agent classify an incoming request and send it down the right workflow, tool, or sub-agent. It is the backbone of this chatbot: a deterministic triage layer routes greetings, contact, and injection attempts before any model call, and a downstream grader routes each question to answer, rewrite, or decline.',
  },
  {
    id: 'parallelization',
    name: 'Parallelization',
    chapter: 3,
    body: 'Run independent sub-tasks at the same time, then synthesize the results, so wall-clock time tracks the slowest branch instead of the sum. Charles applies it when he dispatches several sub-agents or framework passes concurrently in Product Playbook and his Claude Code workflows.',
  },
  {
    id: 'reflection',
    name: 'Reflection',
    chapter: 4,
    body: 'Let the agent critique its own draft against the goal and revise, ideally with a separate critic agent for objectivity. It runs twice in Charles\'s work: the chatbot\'s self-correcting loop grades its own retrieved context and rewrites the query when it falls short, and Product Playbook\'s strategy-critic and pre-mortem-runner are dedicated critic agents.',
  },
  {
    id: 'tool-use',
    name: 'Tool Use (Function Calling)',
    chapter: 5,
    body: 'Give the model structured functions so it can reach past its training data into live systems, querying a database, calling an API, or running code. Charles leans on this heavily as an AI Product Builder, where Claude Code and Codex agents call real tools to build and ship the full stack, and where this chatbot queries Qdrant for retrieval.',
  },
  {
    id: 'planning',
    name: 'Planning',
    chapter: 6,
    body: 'Have the agent decompose a complex goal into an ordered set of steps or sub-goals before it acts. Charles built Product Playbook around this: the system turns a one-line idea into a sequenced, executable PRD with acceptance criteria, plus a CLAUDE.md and TASKS.md for a clean dev handoff.',
  },
  {
    id: 'multi-agent-collaboration',
    name: 'Multi-Agent Collaboration',
    chapter: 7,
    body: 'Split a problem across specialized agents, each in its own context, coordinated toward one outcome. This is the headline pattern in Product Playbook, where three specialists, discovery-specialist, strategy-critic, and pre-mortem-runner, run in separate context windows while a main agent integrates their structured output.',
  },
  {
    id: 'memory-management',
    name: 'Memory Management',
    chapter: 8,
    body: 'Keep short-term conversation state and longer-term knowledge so an agent stays coherent across turns and tasks. Charles treats context as a managed resource in his agent builds, scoping what each sub-agent sees so the work stays grounded instead of drifting as context grows.',
  },
  {
    id: 'learning-and-adaptation',
    name: 'Learning and Adaptation',
    chapter: 9,
    body: 'Let an agent improve from experience or adapt to a changing environment rather than staying fixed. Charles approaches this through eval-driven iteration: he measures behavior, feeds the findings back into prompts and architecture, and tightens the system each cycle.',
  },
  {
    id: 'model-context-protocol',
    name: 'Model Context Protocol (MCP)',
    chapter: 10,
    body: 'A standard interface that lets an agent discover and call external tools and data sources without bespoke glue per integration. Charles works with MCP servers inside his Claude Code workflows, wiring agents to the tools and data they need so capability scales without rewriting plumbing.',
  },
  {
    id: 'goal-setting-and-monitoring',
    name: 'Goal Setting and Monitoring',
    chapter: 11,
    body: 'Give the agent an explicit objective plus the metrics to track progress toward it, so autonomy stays accountable. Charles encodes this as acceptance criteria in Product Playbook and as OKR-style targets in product work, so what counts as done is defined up front and measurable.',
  },
  {
    id: 'exception-handling-and-recovery',
    name: 'Exception Handling and Recovery',
    chapter: 12,
    body: 'Assume tools fail, networks drop, and inputs surprise you, then build retries, fallbacks, and graceful degradation. Charles\'s chatbot is engineered this way: a slow grader degrades to passing context straight through, and the free Gemini tier falls back to Claude on any failure, so a transient error never becomes a dead end.',
  },
  {
    id: 'human-in-the-loop',
    name: 'Human-in-the-Loop',
    chapter: 13,
    body: 'Insert human review or approval at the points where an error would be costly, keeping a person on the critical path. Charles works as that human in his AI Product Builder loop, reviewing and steering what Claude Code and Codex produce before anything ships.',
  },
  {
    id: 'knowledge-retrieval-rag',
    name: 'Knowledge Retrieval (RAG)',
    chapter: 14,
    body: 'Ground answers in external, up-to-date, or proprietary data the model never trained on, for verifiable, fact-based output. This chatbot is Charles\'s own RAG system: hybrid retrieval over Qdrant, dense Voyage embeddings fused with BM25 sparse via reciprocal rank fusion, then a cross-encoder rerank before grounded generation with citations.',
  },
  {
    id: 'inter-agent-communication',
    name: 'Inter-Agent Communication (A2A)',
    chapter: 15,
    body: 'Define how agents exchange requests and results so specialists built separately can still collaborate. In Product Playbook, sub-agents return structured YAML that the main agent consumes, a typed contract that keeps multi-agent hand-offs reliable.',
  },
  {
    id: 'resource-aware-optimization',
    name: 'Resource-Aware Optimization',
    chapter: 16,
    body: 'Spend compute, latency, and money deliberately, picking the cheapest path that still meets the bar. Charles designed this chatbot as a cost-control cascade: deterministic triage and a semantic FAQ cache answer common questions with no model call, and generation runs a free tier first, paying for the stronger model only when needed.',
  },
  {
    id: 'reasoning-techniques',
    name: 'Reasoning Techniques',
    chapter: 17,
    body: 'Use structured reasoning such as chain-of-thought, ReAct, or tree-of-thought when a problem needs decomposition and visible intermediate steps. Charles reaches for these in agent builds where the path to the answer matters as much as the answer, pairing reasoning with tool calls to keep the steps grounded.',
  },
  {
    id: 'guardrails-safety',
    name: 'Guardrails/Safety Patterns',
    chapter: 18,
    body: 'Constrain what an agent will accept and emit, validating inputs and outputs so it stays safe and on-scope. Charles layered this into the chatbot: a prompt-injection deflector, a strict scope-lock that treats all input as data, and an output backstop that drops an answer rather than surface anything offensive.',
  },
  {
    id: 'evaluation-and-monitoring',
    name: 'Evaluation and Monitoring',
    chapter: 19,
    body: 'Measure quality in production and compare versions, so improvement is driven by evidence rather than vibes. Charles built an eval harness for this chatbot with a golden question set, an LLM judge, and metrics, and tracks live usage through chat-log insights.',
  },
  {
    id: 'prioritization',
    name: 'Prioritization',
    chapter: 20,
    body: 'Rank competing tasks or goals under real constraints so the system spends effort where it matters most. Charles applies prioritization frameworks like RICE, both in his product work and in the way Product Playbook sequences what to build first, and he coaches mentees on the same.',
  },
  {
    id: 'exploration-and-discovery',
    name: 'Exploration and Discovery',
    chapter: 21,
    body: 'Operate in open-ended problem spaces by generating and testing hypotheses rather than following a fixed plan. Charles builds this into Product Playbook\'s discovery-specialist and his opportunity-framing practice, which probe the problem space before committing to a solution.',
  },
]
