# Aethelgard — Game Bible

> **"Nothing in this world exists because it was scripted. Everything exists because
> another system caused it."**

This sentence governs every design and engineering decision. If a feature can only
exist by hand-placing it or firing a scripted trigger, it is the wrong design. Villages
exist because fertile land, water, trade routes, and migration allowed them. Wars happen
because kingdoms compete for resources. A king resents you because your actions
threatened his interests — not because a dialogue flag was set.

## What this is

A **living voxel-world simulation** in the lineage of Dwarf Fortress, Crusader Kings,
Mount & Blade, RimWorld, and Kenshi — rendered in a destructible/buildable voxel world.
Minecraft-style building is only the *substrate*. The game is the living world on top:
players build dynasties, influence politics, found civilizations, and leave behind
histories future generations remember.

It is meant to evolve over many years. Every architectural decision optimizes for the
features that don't exist yet, not just today's.

## Design pillars

1. **Emergence over scripting.** Macro outcomes (cities, wars, dynasties, plagues, tech
   eras) are outputs of interacting systems over deterministic time.
2. **The world remembers.** An append-only *chronicle* records significant events.
   Destroyed cities stay ruins; books preserve events; NPCs remember heroes; future
   players discover the past. Legacy matters.
3. **Reward mastery, curiosity, creativity, exploration, discipline.** The player should
   feel they are *becoming someone*, not just collecting stronger gear. Every mechanic
   must answer: "Does this create meaningful stories?"
4. **NPC intelligence is pure on-device simulation — never an LLM/AI API.** Agents are
   intelligent because of Needs, Memory, Relationships, Personality, Emotion, Reputation,
   Schedules, and Utility-AI/GOAP planning — computed locally, offline, at ₹0/month.
   Optional LLM *flavor dialogue* may be an opt-in cosmetic add-on far in the future; it
   must never be load-bearing.
5. **Performance is a feature.** Hold 60–144 FPS on the target tablet through async
   workers, greedy meshing, instancing, culling, and dynamic quality. Never sacrifice the
   architecture for a shortcut.

## Emergent systems (the long arc)

- **Agents:** needs/sleep/food/money/safety, memory, relationships, personality traits,
  emotions, reputation, schedules, skills, inventory, lineage, titles & claims.
- **Economy:** production chains, settlement markets with supply/demand prices, trade
  routes; scarcity propagates (famine → price spikes → banditry).
- **Population & migration:** births/deaths, refugees fleeing famine/war/disease; the
  player chooses to welcome / tax / refuse — each choice reshapes the future.
- **Organic cities:** grow only through causal loops (food → people → craftsmen → economy
  → army → safe roads → trade → food). No "level unlocked."
- **Politics & legacy:** alliances, vassalage, marriages that create inheritable claims,
  children who inherit appearance/talents/personality/titles/wealth/land/relationships/
  enemies; succession crises and civil wars that *emerge*. The player can rise from a
  wooden house to deciding who becomes king — or declaring independence.
- **Disease:** epidemics seeded in a city, carried by travelers along trade routes,
  cascading into closed gates, collapsed trade, paused wars.
- **Knowledge & tech diffusion:** discoveries spread via books, scholars, and merchants
  over years; warfare and tools evolve into new eras naturally (e.g. steel → gunpowder).
- **Combat & skills:** directional attacks, stamina, blocking/parry, dodging; mastery
  that unlocks *capabilities*, not stat percentages.

## Engineering principles

See the architecture plan for detail. In short: strict layering with downward-only
dependencies (`platform → core → worldgen → sim → render → ui`); simulation fully
independent of rendering; ECS with data-oriented, low-GC storage; fixed-timestep
deterministic simulation with a multi-scale world clock and **simulation LOD** (distant
regions simulated abstractly, near regions in agent-level detail); seeded RNG streams for
reproducibility and future multiplayer; everything serializable.

## Milestones

- **M1 — Engine + premium voxel sandbox** (current): the foundation, shipped playable.
- M2 world substrate (regions/settlements, clock, sim-LOD, structures, biomes, weather).
- M3 agents (NPCs/animals, GOAP). M4 survival & combat. M5 settlements & economy.
- M6 politics & legacy. M7 knowledge & disease. M8 history payoff. M9 multiplayer.

Every milestone leaves the project playable. We never rush; foundations first.
