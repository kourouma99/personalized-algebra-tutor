/*
  sampleScenarios.js — fake "AI output", hardcoded for now.

  Later an AI backend will generate this wording. The AI only writes WORDS:
  story text, variable labels, units. It never chooses the numbers.
  The numbers always come from the concept's generateParams() (code).

  That's why the story text uses placeholders like {m} and {b} instead of
  real numbers: views/scenario.js fills them in from state.params.

  Organized by concept id, then interest id, so other concepts can add their
  own scenarios here later (e.g. "constant-velocity").
  Interest ids must match data/interests.js.
*/

export const sampleScenarios = {
  "linear-equation": {
    sports: {
      increase: {
        title: "Season Scoring",
        story: "Your team starts the season with \\({b}\\) bonus points. Every game, you score \\({absM}\\) more points. After \\(x\\) games, your total is \\(y\\) points.",
        question: "How many points will your team have after 8 games?",
        labels: { x: "Games played", y: "Total points" },
        units: { x: "games", y: "points" },
      },
      decrease: {
        title: "Practice Balls",
        story: "Your team begins the season with \\({b}\\) practice balls. Every game, \\({absM}\\) balls get lost or worn out. After \\(x\\) games, you have \\(y\\) balls left.",
        question: "How many balls will be left after 8 games?",
        labels: { x: "Games played", y: "Balls left" },
        units: { x: "games", y: "balls" },
      },
    },
    music: {
      increase: {
        title: "Growing Playlist",
        story: "Your playlist already has \\({b}\\) songs. Every week, you add \\({absM}\\) new songs. After \\(x\\) weeks, it has \\(y\\) songs.",
        question: "How many songs will be in your playlist after 8 weeks?",
        labels: { x: "Weeks", y: "Songs in playlist" },
        units: { x: "weeks", y: "songs" },
      },
      decrease: {
        title: "Studio Time",
        story: "You booked \\({b}\\) hours of studio time. Each day of recording uses \\({absM}\\) hours. After \\(x\\) days, you have \\(y\\) hours left.",
        question: "How many hours will be left after 8 days?",
        labels: { x: "Days recording", y: "Hours left" },
        units: { x: "days", y: "hours" },
      },
    },
    gaming: {
      increase: {
        title: "Coin Collector",
        story: "You start a level with \\({b}\\) coins and earn \\({absM}\\) coins every minute. After \\(x\\) minutes, you have \\(y\\) coins.",
        question: "How many coins will you have after 8 minutes?",
        labels: { x: "Minutes played", y: "Coins" },
        units: { x: "minutes", y: "coins" },
      },
      decrease: {
        title: "Health Bar",
        story: "Your character starts with \\({b}\\) health points and loses \\({absM}\\) every minute in the storm. After \\(x\\) minutes, \\(y\\) health points are left.",
        question: "How much health will be left after 8 minutes?",
        labels: { x: "Minutes in storm", y: "Health left" },
        units: { x: "minutes", y: "health points" },
      },
    },
    animals: {
      increase: {
        title: "Shelter Adoptions",
        story: "An animal shelter has already found homes for \\({b}\\) animals. Each week, \\({absM}\\) more are adopted. After \\(x\\) weeks, \\(y\\) animals have homes.",
        question: "How many animals will have homes after 8 weeks?",
        labels: { x: "Weeks", y: "Animals adopted" },
        units: { x: "weeks", y: "animals" },
      },
      decrease: {
        title: "Bird Feeder",
        story: "A bird feeder holds \\({b}\\) ounces of seed. Birds eat \\({absM}\\) ounces each day. After \\(x\\) days, \\(y\\) ounces are left.",
        question: "How much seed will be left after 8 days?",
        labels: { x: "Days", y: "Ounces of seed left" },
        units: { x: "days", y: "ounces" },
      },
    },
  },
};

// Returns the scenario for a concept + interest (+ variant, if the scenario has variants)
export function getScenario(conceptId, interestId, variant) {
  const scenario = sampleScenarios[conceptId]?.[interestId];
  if (!scenario) return null;
  return variant && scenario[variant] ? scenario[variant] : scenario;
}