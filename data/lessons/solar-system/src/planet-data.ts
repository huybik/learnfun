/**
 * Complete planet data for the Solar System lesson.
 * All 8 planets + the Sun with kid-friendly descriptions and fun facts.
 */

export interface PlanetSurfaceFeatures {
  baseColor: [number, number, number]
  secondaryColor?: [number, number, number]
  noiseScale: number
  type: 'gas' | 'rocky' | 'ice' | 'star'
}

export interface PlanetData {
  name: string
  radius: number
  orbitRadius: number
  orbitSpeed: number
  rotationSpeed: number
  color: string
  emissiveColor?: string
  emissiveIntensity?: number
  description: string
  funFacts: string[]
  hasRings?: boolean
  ringColor?: string
  ringInnerRadius?: number
  ringOuterRadius?: number
  atmosphere?: string
  textureType: 'procedural'
  surfaceFeatures: PlanetSurfaceFeatures
  moons?: number
  temperature: string
  dayLength: string
  yearLength: string
}

export const PLANET_DATA: PlanetData[] = [
  {
    name: 'Sun',
    radius: 3.0,
    orbitRadius: 0,
    orbitSpeed: 0,
    rotationSpeed: 0.1,
    color: '#FDB813',
    emissiveColor: '#FDB813',
    emissiveIntensity: 2.0,
    description:
      'The Sun is a giant ball of super-hot glowing gas called a star! It is so big that over one million Earths could fit inside it. The Sun gives us light and warmth, making life on Earth possible.',
    funFacts: [
      'The Sun is about 4.6 billion years old — almost as old as the solar system itself!',
      'Light from the Sun takes about 8 minutes to reach Earth.',
      'The surface of the Sun is about 5,500 degrees Celsius — hot enough to melt anything!',
      'The Sun is made mostly of hydrogen and helium gas.',
    ],
    textureType: 'procedural',
    surfaceFeatures: {
      baseColor: [1.0, 0.72, 0.07],
      secondaryColor: [1.0, 0.3, 0.0],
      noiseScale: 4.0,
      type: 'star',
    },
    temperature: 'Super hot! 5,500°C on the surface',
    dayLength: '25 Earth days (at the equator)',
    yearLength: 'It does not orbit anything!',
  },
  {
    name: 'Mercury',
    radius: 0.4,
    orbitRadius: 6,
    orbitSpeed: 0.04,
    rotationSpeed: 0.5,
    color: '#A0908A',
    description:
      'Mercury is the smallest planet and the closest to the Sun. It is a tiny, rocky world covered in craters, kind of like our Moon! Even though it is closest to the Sun, it is not the hottest planet.',
    funFacts: [
      'Mercury is only a little bigger than our Moon!',
      'A year on Mercury is just 88 Earth days — the fastest orbit of any planet.',
      'Mercury has no atmosphere, so it has no weather at all.',
      'During the day it can reach 430°C, but at night it drops to -180°C!',
    ],
    textureType: 'procedural',
    surfaceFeatures: {
      baseColor: [0.63, 0.56, 0.54],
      secondaryColor: [0.45, 0.4, 0.38],
      noiseScale: 8.0,
      type: 'rocky',
    },
    moons: 0,
    temperature: 'Extreme! 430°C day, -180°C night',
    dayLength: '59 Earth days',
    yearLength: '88 Earth days',
  },
  {
    name: 'Venus',
    radius: 0.7,
    orbitRadius: 9,
    orbitSpeed: 0.03,
    rotationSpeed: -0.2,
    color: '#E8CDA0',
    atmosphere: '#E8CDA055',
    description:
      'Venus is sometimes called Earth\'s twin because they are almost the same size. But Venus is the hottest planet in the solar system! Thick clouds of acid cover the whole planet, trapping heat like a super-powered greenhouse.',
    funFacts: [
      'Venus spins backwards compared to most planets!',
      'A day on Venus is longer than a year on Venus — how weird is that?',
      'Venus is the brightest planet in our night sky — you can see it without a telescope!',
      'The surface pressure on Venus would crush you like being deep underwater.',
    ],
    textureType: 'procedural',
    surfaceFeatures: {
      baseColor: [0.91, 0.8, 0.63],
      secondaryColor: [0.85, 0.65, 0.4],
      noiseScale: 5.0,
      type: 'rocky',
    },
    moons: 0,
    temperature: 'Very hot! 465°C (hottest planet!)',
    dayLength: '243 Earth days',
    yearLength: '225 Earth days',
  },
  {
    name: 'Earth',
    radius: 0.75,
    orbitRadius: 12,
    orbitSpeed: 0.025,
    rotationSpeed: 0.8,
    color: '#4A90D9',
    atmosphere: '#4A90D933',
    description:
      'Earth is our home! It is the only planet we know of that has liquid water on its surface and living things. From space, Earth looks like a beautiful blue marble because of all its oceans.',
    funFacts: [
      'About 71% of Earth\'s surface is covered by water — that is why it looks blue from space!',
      'Earth is the only planet not named after a Greek or Roman god.',
      'Earth\'s atmosphere protects us from the Sun\'s harmful rays like a giant shield.',
      'Earth is about 4.5 billion years old.',
    ],
    textureType: 'procedural',
    surfaceFeatures: {
      baseColor: [0.15, 0.4, 0.7],
      secondaryColor: [0.2, 0.55, 0.15],
      noiseScale: 6.0,
      type: 'rocky',
    },
    moons: 1,
    temperature: 'Just right! Average 15°C',
    dayLength: '24 hours',
    yearLength: '365.25 days',
  },
  {
    name: 'Mars',
    radius: 0.55,
    orbitRadius: 15.5,
    orbitSpeed: 0.02,
    rotationSpeed: 0.75,
    color: '#C1440E',
    atmosphere: '#C1440E22',
    description:
      'Mars is called the Red Planet because its soil is full of rusty iron, making everything look reddish! It has the tallest volcano and the deepest canyon in the entire solar system. Scientists are working on sending people to Mars someday!',
    funFacts: [
      'Mars has the tallest mountain in the solar system — Olympus Mons is 3 times taller than Mount Everest!',
      'Mars has two tiny moons named Phobos and Deimos (Fear and Panic in Greek).',
      'A day on Mars is almost the same length as a day on Earth — about 24 hours and 37 minutes.',
      'Robots called rovers have been exploring Mars and sending back amazing photos!',
    ],
    textureType: 'procedural',
    surfaceFeatures: {
      baseColor: [0.76, 0.27, 0.05],
      secondaryColor: [0.6, 0.2, 0.08],
      noiseScale: 7.0,
      type: 'rocky',
    },
    moons: 2,
    temperature: 'Cold! Average -60°C',
    dayLength: '24 hours 37 minutes',
    yearLength: '687 Earth days',
  },
  {
    name: 'Jupiter',
    radius: 2.0,
    orbitRadius: 22,
    orbitSpeed: 0.012,
    rotationSpeed: 1.2,
    color: '#C88B3A',
    atmosphere: '#C88B3A22',
    description:
      'Jupiter is the biggest planet in our solar system — you could fit over 1,300 Earths inside it! It is a giant ball of gas with no solid surface. Its famous Great Red Spot is actually a huge storm that has been raging for hundreds of years!',
    funFacts: [
      'Jupiter\'s Great Red Spot is a storm bigger than Earth that has lasted over 350 years!',
      'Jupiter has at least 95 known moons — the most of any planet!',
      'Jupiter spins so fast that a day there is only about 10 hours long.',
      'Jupiter acts like a giant space vacuum cleaner, protecting Earth from asteroids with its gravity.',
    ],
    textureType: 'procedural',
    surfaceFeatures: {
      baseColor: [0.78, 0.55, 0.23],
      secondaryColor: [0.65, 0.35, 0.15],
      noiseScale: 3.0,
      type: 'gas',
    },
    moons: 95,
    temperature: 'Very cold! -110°C at cloud tops',
    dayLength: '10 hours',
    yearLength: '12 Earth years',
  },
  {
    name: 'Saturn',
    radius: 1.7,
    orbitRadius: 29,
    orbitSpeed: 0.008,
    rotationSpeed: 1.1,
    color: '#E8D5A3',
    atmosphere: '#E8D5A322',
    hasRings: true,
    ringColor: '#D4C5A0',
    ringInnerRadius: 2.0,
    ringOuterRadius: 3.5,
    description:
      'Saturn is famous for its beautiful rings! These rings are made of billions of pieces of ice and rock, some as tiny as grains of sand and others as big as houses. Saturn is so light that if you could find a bathtub big enough, it would float!',
    funFacts: [
      'Saturn\'s rings are mostly made of ice and rock, and they stretch out hundreds of thousands of kilometers!',
      'Saturn is so light for its size that it would float in water if you had a big enough pool!',
      'Saturn has 146 known moons — even more than Jupiter!',
      'Saturn\'s moon Titan has lakes and rivers, but they are made of liquid methane, not water.',
    ],
    textureType: 'procedural',
    surfaceFeatures: {
      baseColor: [0.91, 0.84, 0.64],
      secondaryColor: [0.82, 0.7, 0.45],
      noiseScale: 3.0,
      type: 'gas',
    },
    moons: 146,
    temperature: 'Freezing! -140°C at cloud tops',
    dayLength: '10.7 hours',
    yearLength: '29 Earth years',
  },
  {
    name: 'Uranus',
    radius: 1.1,
    orbitRadius: 36,
    orbitSpeed: 0.005,
    rotationSpeed: -0.7,
    color: '#72B4C4',
    atmosphere: '#72B4C433',
    hasRings: true,
    ringColor: '#7799AA',
    ringInnerRadius: 1.5,
    ringOuterRadius: 2.2,
    description:
      'Uranus is an ice giant that rolls around the Sun on its side, like a bowling ball! It has a beautiful blue-green color because of methane gas in its atmosphere. Uranus is one of the coldest planets in the solar system.',
    funFacts: [
      'Uranus is tilted on its side — it basically rolls around the Sun like a ball!',
      'Uranus has 28 known moons, all named after characters from Shakespeare and Alexander Pope.',
      'It takes Uranus 84 Earth years to go around the Sun — that means one Uranus year is a whole human lifetime!',
      'Uranus was the first planet discovered with a telescope, in 1781.',
    ],
    textureType: 'procedural',
    surfaceFeatures: {
      baseColor: [0.45, 0.71, 0.77],
      secondaryColor: [0.35, 0.6, 0.7],
      noiseScale: 2.5,
      type: 'ice',
    },
    moons: 28,
    temperature: 'Super cold! -224°C',
    dayLength: '17 hours',
    yearLength: '84 Earth years',
  },
  {
    name: 'Neptune',
    radius: 1.05,
    orbitRadius: 43,
    orbitSpeed: 0.003,
    rotationSpeed: 0.8,
    color: '#3E54A3',
    atmosphere: '#3E54A333',
    description:
      'Neptune is the farthest planet from the Sun and the windiest place in the solar system! Winds on Neptune can blow over 2,000 kilometers per hour — way faster than any hurricane on Earth. It has a beautiful deep blue color.',
    funFacts: [
      'Neptune has the strongest winds in the solar system — over 2,000 km/h!',
      'Neptune was discovered using math before anyone ever saw it through a telescope.',
      'It takes Neptune 165 Earth years to orbit the Sun — it only finished its first full orbit since discovery in 2011!',
      'Neptune\'s moon Triton orbits backwards and might be a captured dwarf planet.',
    ],
    textureType: 'procedural',
    surfaceFeatures: {
      baseColor: [0.24, 0.33, 0.64],
      secondaryColor: [0.18, 0.25, 0.55],
      noiseScale: 3.0,
      type: 'ice',
    },
    moons: 16,
    temperature: 'Incredibly cold! -214°C',
    dayLength: '16 hours',
    yearLength: '165 Earth years',
  },
]

/** Get planet data by name (case-insensitive) */
export function getPlanetByName(name: string): PlanetData | undefined {
  return PLANET_DATA.find((p) => p.name.toLowerCase() === name.toLowerCase())
}

/** Planets only (excludes the Sun) */
export const PLANETS_ONLY = PLANET_DATA.filter((p) => p.name !== 'Sun')

/** The Sun */
export const SUN_DATA = PLANET_DATA[0]
