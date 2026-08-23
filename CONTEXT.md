# Board Game Simulation

This context describes the games and play experiences available through the board game simulator.

## Language

**Playable Game**:
A game that players can start, join, and play through to a terminal result. It is distinct from an announced game that is not yet available to play.
_Avoid_: Live game, supported game

**Realm**:
A Hex Kingdoms player's permanently owned terrain tiles. A realm may contain disconnected expeditions, while Crownlands are only the tiles connected to its capital.
_Avoid_: Territory, empire

**Landmark**:
A neutral Hex Kingdoms location contested through the adjacent tiles owned by each player. A landmark is never owned or occupied by a drafted tile.
_Avoid_: Objective, control point

**Packet**:
A Signal Crew card identified by a channel and rank. A player sees teammates' packets but must deduce their own.
_Avoid_: Playing card, signal card

**Relay**:
A public Signal Crew repair target containing two exact packet sockets. The crew wins by filling every relay.
_Avoid_: Mission, objective card

**Bandwidth**:
The shared Signal Crew currency spent to give clues and recovered by recycling packets or completing relays.
_Avoid_: Clue token, energy

**Interference**:
The shared Signal Crew mistake track increased by incorrect transmissions.
_Avoid_: Life, strike
