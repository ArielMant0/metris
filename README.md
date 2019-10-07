# Metris
A Multiplayer Tetris

## TODO

### server
- push to university server
- check that everything works
- push to heroku as well if possible/enough time

### game logic
- fix point per line according to level
    - x * speed_modifier + (num_lines-1) * bonus
    - should placing stones reward points?
    - multiple lines at same time should give more points?
- check level speed scales correctly
- check that dropping stones at the same position creates an unbreakable block
- does each player have a different score? (add option to settings)
- send game over to all players
- disable movement after game over
- check if only the player that placed the last stone gets the points

### ui
- check that login works and redirects to game
- add space description to control page
- can we enable rotating as spectator
- fix spectator mode
- update ui when players create, join or leave lobbies

### rendering
- fix particle system not moving after the first level
- fix transparency
