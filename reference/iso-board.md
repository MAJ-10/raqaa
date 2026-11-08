# The iso board and the podium

Reference implementation: `reference/map9.py` (board), `reference/mark3.py` (logo), `reference/mayor.py` (`model_a`, the final podium). Screens: `docs/screens/D01.png` to `D21.png`.

## Projection

All 3D in Raqaa uses one projection. Plan coordinates `(i, j)` are in plot units, `z` is height, `s` is pixels per unit:

```
x = (i - j) * cos45 * s
y = (i + j) * cos45 * cos55 * s  -  z * sin55 * s
```

- `i` runs to the screen's lower right and `j` to its lower left.
- A box shows its top and two faces:
  - **Left face:** the face at `j = max`, filled with the palette's 2nd colour.
  - **Right face:** the face at `i = max`, filled with the 3rd colour.
  - The split between the two faces is the screen x of the front corner `(i max, j max)`.
- Draw the plots back to front, sorted by `i + j`.
- Every box has a rounded plan: offset a square inwards by the radius, then buffer it outwards again.

## Constants (map9.py)

| Name | Value | Meaning |
| --- | --- | --- |
| `GAP` | 0.12 | gap between plots |
| `R_TILE` | 0.13 | plot corner radius |
| `TH` | 0.16 | empty plot thickness |
| `STEP` | 0.17 | height per point of value |
| `MARGIN` | 0.32 | plate margin around the grid |
| `PLATE_TH` | 0.22 | plate thickness |

## Plots

- **Plate:** one rounded box under the whole grid.
- **Empty plot**
  - It is a tile `TH` thick, in the value tone `v2`, `v3` or `v4`.
  - If an action card is on it, the card's icon sits flat on its top, 0.56 of a plot wide.
- **Owned plot**
  - Its height is `TH + value * STEP`. Bases count as value 1.
  - It takes the team palette (main, side, side2) with the team symbol flat on its roof, 0.40 of a plot wide, in ink.
  - The symbol is oriented upright toward the viewer: its x axis runs along plan (1, -1) and its y axis along (1, 1).
- **Center (برج الرقعة):** a flat tile in its own colour until a team takes it, then `TH + 5 * STEP` in that team's colours.
- **Available plots on a team's turn**
  - They rise to the height they would have if that team built there.
  - Each gets a dotted border in the team's side colour on its top.
- **Auction:** a pin with the bidder's badge above the plot.
- **Palettes:** day and night are in `assets/tokens.json` under `map`. Night is used for the announcement.
- **7×7:** the same rules, with the values, cards and bases from the requirements.

## Final podium (D21, approved)

- **Layout:** four towers stand in one horizontal row, first on the right, at screen spacing 290px.
  - Each tower centre is `((k - 1.5) * D, -(k - 1.5) * D)` with `D = 290 / (2 * cos45 * s)`, `s = 56`.
  - `k` runs from 0 for the fourth (leftmost) to 3 for the first (rightmost).
- **Tower shape**
  - The footprint is 1.9 × 1.9, corner radius 0.16.
  - Floors are 0.78 high. The towers have 8, 6, 4 and 2 floors, first to fourth.
  - Between floors there is a recessed seam 0.08 high, inset by 0.07, in a darkened side2.
- **Tower details**
  - Each floor has two lit windows on each face: `#FFF1C4` on the left face, `#FFE29A` on the right face.
  - The roof carries the team symbol. The winner's roof carries the crown (`--crown`, `#FFD166`) instead.
  - Each tower stands on a night tile.
- **Labels**
  - Above each roof floats the population bubble (white pill, house icon and number).
  - Under each tower is the team plate, in the team colour with its symbol and name, and the rank in a white disc.
- **Title:** «عمدة الرقعة», with the game icon (`assets/brand/mark.svg`) on its right.
- **Background:** night sky with stars, the far city lit, and a soft gold glow behind the winner.
- **Motion:**
  1. The towers rise from fourth to first.
  2. The numbers count up.
  3. The crown lands last.
