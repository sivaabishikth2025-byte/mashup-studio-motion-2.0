export type Category =
  | "Animals"
  | "Objects"
  | "Foods"
  | "Places"
  | "Vehicles"
  | "Fantasy"
  | "Technology"
  | "Space"
  | "Professions";

export type Ingredient = {
  id: string;
  label: string;
  emoji: string;
  category: Category;
};

export const CATEGORIES: Category[] = [
  "Animals",
  "Objects",
  "Foods",
  "Places",
  "Vehicles",
  "Fantasy",
  "Technology",
  "Space",
  "Professions",
];

export const INGREDIENTS: Ingredient[] = [
  { id: "shark", label: "Shark", emoji: "🦈", category: "Animals" },
  { id: "panda", label: "Panda", emoji: "🐼", category: "Animals" },
  { id: "octopus", label: "Octopus", emoji: "🐙", category: "Animals" },
  { id: "cactus", label: "Cactus", emoji: "🌵", category: "Foods" },
  { id: "owl", label: "Owl", emoji: "🦉", category: "Animals" },
  { id: "fox", label: "Fox", emoji: "🦊", category: "Animals" },
  { id: "wolf", label: "Wolf", emoji: "🐺", category: "Animals" },
  { id: "frog", label: "Frog", emoji: "🐸", category: "Animals" },
  { id: "bee", label: "Bee", emoji: "🐝", category: "Animals" },
  { id: "whale", label: "Whale", emoji: "🐋", category: "Animals" },
  { id: "axolotl", label: "Axolotl", emoji: "🩷", category: "Animals" },
  { id: "raven", label: "Raven", emoji: "🐦‍⬛", category: "Animals" },
  { id: "chameleon", label: "Chameleon", emoji: "🦎", category: "Animals" },
  { id: "jellyfish", label: "Jellyfish", emoji: "🪼", category: "Animals" },
  { id: "sloth", label: "Sloth", emoji: "🦥", category: "Animals" },
  { id: "guitar", label: "Guitar", emoji: "🎸", category: "Objects" },
  { id: "violin", label: "Violin", emoji: "🎻", category: "Objects" },
  { id: "umbrella", label: "Umbrella", emoji: "☂️", category: "Objects" },
  { id: "clock", label: "Clock", emoji: "🕰️", category: "Objects" },
  { id: "lantern", label: "Lantern", emoji: "🏮", category: "Objects" },
  { id: "typewriter", label: "Typewriter", emoji: "⌨️", category: "Objects" },
  { id: "telescope", label: "Telescope", emoji: "🔭", category: "Objects" },
  { id: "compass", label: "Compass", emoji: "🧭", category: "Objects" },
  { id: "mirror", label: "Mirror", emoji: "🪞", category: "Objects" },
  { id: "backpack", label: "Backpack", emoji: "🎒", category: "Objects" },
  { id: "pizza", label: "Pizza", emoji: "🍕", category: "Foods" },
  { id: "ice-cream", label: "Ice Cream", emoji: "🍦", category: "Foods" },
  { id: "coffee", label: "Coffee", emoji: "☕", category: "Foods" },
  { id: "ramen", label: "Ramen", emoji: "🍜", category: "Foods" },
  { id: "avocado", label: "Avocado", emoji: "🥑", category: "Foods" },
  { id: "chili", label: "Chili", emoji: "🌶️", category: "Foods" },
  { id: "honey", label: "Honey", emoji: "🍯", category: "Foods" },
  { id: "pretzel", label: "Pretzel", emoji: "🥨", category: "Foods" },
  { id: "matcha", label: "Matcha", emoji: "🍵", category: "Foods" },
  { id: "volcano", label: "Volcano", emoji: "🌋", category: "Places" },
  { id: "castle", label: "Castle", emoji: "🏰", category: "Places" },
  { id: "library", label: "Library", emoji: "📚", category: "Places" },
  { id: "lighthouse", label: "Lighthouse", emoji: "🗼", category: "Places" },
  { id: "jungle", label: "Jungle", emoji: "🌴", category: "Places" },
  { id: "subway", label: "Subway", emoji: "🚇", category: "Places" },
  { id: "oasis", label: "Oasis", emoji: "🏝️", category: "Places" },
  { id: "museum", label: "Museum", emoji: "🏛️", category: "Places" },
  { id: "reef", label: "Coral Reef", emoji: "🪸", category: "Places" },
  { id: "spaceship", label: "Spaceship", emoji: "🚀", category: "Vehicles" },
  { id: "submarine", label: "Submarine", emoji: "🛳️", category: "Vehicles" },
  { id: "hot-air-balloon", label: "Hot Air Balloon", emoji: "🎈", category: "Vehicles" },
  { id: "train", label: "Night Train", emoji: "🚂", category: "Vehicles" },
  { id: "skateboard", label: "Skateboard", emoji: "🛹", category: "Vehicles" },
  { id: "sailboat", label: "Sailboat", emoji: "⛵", category: "Vehicles" },
  { id: "monorail", label: "Monorail", emoji: "🚝", category: "Vehicles" },
  { id: "dragon", label: "Dragon", emoji: "🐉", category: "Fantasy" },
  { id: "phoenix", label: "Phoenix", emoji: "🔥", category: "Fantasy" },
  { id: "unicorn", label: "Unicorn", emoji: "🦄", category: "Fantasy" },
  { id: "golem", label: "Golem", emoji: "🪨", category: "Fantasy" },
  { id: "fairy", label: "Fairy", emoji: "🧚", category: "Fantasy" },
  { id: "kraken", label: "Kraken", emoji: "🦑", category: "Fantasy" },
  { id: "portal", label: "Portal", emoji: "🌀", category: "Fantasy" },
  { id: "robot", label: "Robot", emoji: "🤖", category: "Technology" },
  { id: "satellite", label: "Satellite", emoji: "🛰️", category: "Technology" },
  { id: "hologram", label: "Hologram", emoji: "💠", category: "Technology" },
  { id: "server", label: "Server Farm", emoji: "💾", category: "Technology" },
  { id: "drone", label: "Drone", emoji: "🚁", category: "Technology" },
  { id: "neon-sign", label: "Neon Sign", emoji: "💡", category: "Technology" },
  { id: "moon", label: "Moon", emoji: "🌙", category: "Space" },
  { id: "nebula", label: "Nebula", emoji: "🌌", category: "Space" },
  { id: "comet", label: "Comet", emoji: "☄️", category: "Space" },
  { id: "black-hole", label: "Black Hole", emoji: "🕳️", category: "Space" },
  { id: "asteroid", label: "Asteroid", emoji: "🪨", category: "Space" },
  { id: "constellation", label: "Constellation", emoji: "✨", category: "Space" },
  { id: "chef", label: "Chef", emoji: "👨‍🍳", category: "Professions" },
  { id: "detective", label: "Detective", emoji: "🕵️", category: "Professions" },
  { id: "astronaut", label: "Astronaut", emoji: "👩‍🚀", category: "Professions" },
  { id: "librarian", label: "Librarian", emoji: "📖", category: "Professions" },
  { id: "lighthouse-keeper", label: "Lighthouse Keeper", emoji: "🕯️", category: "Professions" },
  { id: "cartographer", label: "Cartographer", emoji: "🗺️", category: "Professions" },
  { id: "beekeeper", label: "Beekeeper", emoji: "🍯", category: "Professions" },
  { id: "conductor", label: "Orchestra Conductor", emoji: "🎼", category: "Professions" },
];

export function getIngredient(id: string) {
  return INGREDIENTS.find((item) => item.id === id);
}
