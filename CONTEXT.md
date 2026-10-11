# Writing

Canon for a novel or LitRPG manuscript: what is true about the world at a point in the story.

## Language

**World flag**:
A named boolean that belongs to the world, not to one character.
_Avoid_: Global variable, quest toggle

**Scene step**:
One distinct chapter-and-scene pair later than the scene where a status was applied.
_Avoid_: Tick, turn, beat

**Mundo entity**:
A named thing in the world that is not a character: a faction, artifact, region, spell, or piece of lore.
_Avoid_: Lore node, world object

**Membership**:
A character's place in a faction.
_Avoid_: Allegiance score, party slot

**Location**:
The region a character is in.
_Avoid_: Coordinates, position, scene
