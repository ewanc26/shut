# shut website — design system

## Scene

A hanging “Open / Shut” sign on a bottle-green painted door, with printed cream notices below.

## Colour

Tokens live in `src/routes/layout.css`.

| Token      | OKLCH                 | Role                              |
| ---------- | --------------------- | --------------------------------- |
| paint      | oklch(0.27 0.047 168) | Page ground, the door             |
| paint-deep | oklch(0.22 0.04 168)  | Footer, text on cream             |
| enamel     | oklch(0.95 0.028 90)  | Text on green, notice sections    |
| signal     | oklch(0.52 0.19 28)   | The shut face, focus on cream     |
| brass      | oklch(0.8 0.11 85)    | Sign cord, rules, links and focus |

Red is reserved for the verdict. Do not use it for decoration or buttons.

## Typography

- **Sign and headings:** Bricolage Grotesque Variable, narrowed, weight 800.
- **Body:** Atkinson Hyperlegible Next Variable.

Both are self-hosted.

## Layout

The first screen pairs the try-it box with the sign that answers it. Later sections are full-width
notices that alternate green and cream, with a heading column beside the text.

## Motion

One movement: the sign turns over when the verdict changes. It is instant under
`prefers-reduced-motion`.

## Accessibility

The sign is decorative; the verdict is always written out in a live region. Colour never carries it
alone.

## Bans

- No gradients or glass effects
- No centred hero with two buttons
- No card grids or side-stripe borders
- No slurs anywhere on the page, and no word-list terms as decoration
