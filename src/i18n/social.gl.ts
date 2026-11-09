// SPEC-066 CA-8 (ADR-030 §6, D-2): the templates of the account of X, in
// galego and outside Dictionary: the account publishes in one language only.
// Rendered by src/social/text.ts. Tokens: {team} (Team.name of the side that
// scored), {home}, {away} (Team.name, never truncated), {score} (2-1) and
// {minute} (45+2', as on screen); a segment in [brackets] is dropped when the
// minute is null. {team} never follows a contraction (do, da, ao, á, no,
// na): the gender of a federative name varies. No «@»: no mentions. The ids
// are stable: social_posts.template_id cites them.

export type SocialTemplate = { id: string; text: string };

export const GOAL_TEMPLATES: readonly SocialTemplate[] = [
  {
    id: "goal-1",
    text: "GOOOL! Marca {team}[ ({minute})].\n{home} {score} {away}",
  },
  {
    id: "goal-2",
    text: "Gol de {team}[ ({minute})]!\n{home} {score} {away}",
  },
  {
    id: "goal-3",
    text: "GOL! {team} move o marcador[ ({minute})].\n{home} {score} {away}",
  },
  {
    id: "goal-4",
    text: "{team} marca[ ({minute})]!\nAsí vai o partido: {home} {score} {away}",
  },
  {
    id: "goal-5",
    text: "Tanto de {team}[ ({minute})].\n{home} {score} {away}",
  },
  {
    id: "goal-6",
    text: "GOOOL de {team}[ ({minute})]!\nMarcador: {home} {score} {away}",
  },
];

export const GOAL_ANNULLED_TEMPLATES: readonly SocialTemplate[] = [
  {
    id: "annulled-1",
    text: "Gol anulado a {team}[ ({minute})].\n{home} {score} {away}",
  },
  {
    id: "annulled-2",
    text: "Corrección: non sobe o gol de {team}[ ({minute})].\nO marcador queda {home} {score} {away}",
  },
  {
    id: "annulled-3",
    text: "Gol anulado! Non conta o tanto de {team}[ ({minute})].\n{home} {score} {away}",
  },
];
