import { serverEnv } from '@/lib/server-env';

type GeocodeBody = {
  location?: unknown;
};

type NominatimResult = {
  lat?: unknown;
  lon?: unknown;
  display_name?: unknown;
};

type PhotonFeature = {
  geometry?: {
    coordinates?: unknown;
  };
  properties?: {
    name?: unknown;
    housenumber?: unknown;
    street?: unknown;
    city?: unknown;
    state?: unknown;
    country?: unknown;
    osm_key?: unknown;
    osm_value?: unknown;
  };
};

type PhotonResponse = {
  features?: PhotonFeature[];
};

type GeocodeResult = {
  coordinates: [number, number];
  displayName: string;
  provider: 'nominatim' | 'photon';
  attribution: string;
};

const VINH_VIEWBOX = '105.55,18.82,105.82,18.55';
const VINH_BBOX = '105.55,18.55,105.82,18.82';
const MIN_REQUEST_INTERVAL_MS = 1_050;
const CACHE_TTL_MS = 24 * 60 * 60 * 1_000;
const geocodeCache = new Map<
  string,
  { expiresAt: number; value: GeocodeResult | null }
>();
let requestQueue: Promise<void> = Promise.resolve();
let nextRequestAt = 0;

function normalizeLocation(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').slice(0, 180);
}

function cacheKey(location: string) {
  return location.toLocaleLowerCase('en-US');
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function localizeEnglishPlaceName(location: string) {
  const replacements: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
    [
      /^(.+?)\s+Bridge(?:\s+(\d+))?$/i,
      (match) => `Cau ${match[1]} ${match[2] ?? ''}`,
    ],
    [/^(.+?)\s+Railway Station$/i, (match) => `Ga ${match[1]}`],
    [/^(.+?)\s+University$/i, (match) => `Truong Dai hoc ${match[1]}`],
    [/^(.+?)\s+Market$/i, (match) => `Cho ${match[1]}`],
    [/^(.+?)\s+Hospital$/i, (match) => `Benh vien ${match[1]}`],
    [/^(.+?)\s+Street$/i, (match) => `Duong ${match[1]}`],
    [/^(.+?)\s+Square$/i, (match) => `Quang truong ${match[1]}`],
  ];

  for (const [pattern, replacement] of replacements) {
    const match = location.match(pattern);
    if (match) return replacement(match).replace(/\s+/g, ' ').trim();
  }
  return location;
}

function searchVariants(location: string) {
  const withoutQualifier = location.split(',')[0].trim();
  const withoutOperationalDetail = withoutQualifier
    .replace(
      /\s+(?:northern|southern|eastern|western)\s+(?:approach|entrance|hall|road)$/i,
      '',
    )
    .replace(/\s+(?:access road|sports hall)$/i, '')
    .trim();
  const bases = unique([withoutOperationalDetail, withoutQualifier, location]);
  return unique([...bases.map(localizeEnglishPlaceName), ...bases]);
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function throttledFetch(url: URL) {
  let response: Response | undefined;
  const request = requestQueue
    .catch(() => undefined)
    .then(async () => {
      const wait = Math.max(0, nextRequestAt - Date.now());
      if (wait > 0) await sleep(wait);
      response = await fetch(url, {
        headers: {
          accept: 'application/json',
          'accept-language': 'en',
          'user-agent':
            serverEnv('GEOCODER_USER_AGENT') ??
            'CrisisSignal/0.1 (local emergency-response hackathon prototype)',
        },
      });
      nextRequestAt = Date.now() + MIN_REQUEST_INTERVAL_MS;
    });
  requestQueue = request.then(
    () => undefined,
    () => undefined,
  );
  await request;
  if (!response) throw new Error('The geocoder did not return a response.');
  return response;
}

function parseCoordinates(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const longitude = Number(value[0]);
  const latitude = Number(value[1]);
  if (
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude) ||
    !isWithinVinh(longitude, latitude)
  ) {
    return null;
  }
  return [longitude, latitude];
}

function photonDisplayName(feature: PhotonFeature, fallback: string) {
  const properties = feature.properties ?? {};
  const street = [properties.housenumber, properties.street]
    .filter((part): part is string => typeof part === 'string' && Boolean(part))
    .join(' ');
  const parts = [
    properties.name,
    street,
    properties.city,
    properties.state,
    properties.country,
  ].filter((part): part is string => typeof part === 'string' && Boolean(part));
  return unique(parts).join(', ') || fallback;
}

function comparableName(value: unknown) {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLocaleLowerCase('en-US');
}

function photonMatchScore(feature: PhotonFeature, query: string) {
  const rawCandidate =
    typeof feature.properties?.name === 'string' ? feature.properties.name : '';
  const candidates = unique([
    comparableName(rawCandidate),
    comparableName(localizeEnglishPlaceName(rawCandidate)),
  ]);
  const expected = comparableName(query);
  if (candidates.length === 0 || !expected) return 0;
  const osmKey = comparableName(feature.properties?.osm_key);
  const osmValue = comparableName(feature.properties?.osm_value);
  let categoryBonus = 0;
  if (
    (expected.startsWith('cho ') || expected.endsWith(' market')) &&
    osmValue === 'marketplace'
  ) {
    categoryBonus = 20_000;
  } else if (
    (expected.startsWith('truong dai hoc ') ||
      expected.endsWith(' university')) &&
    osmValue === 'university'
  ) {
    categoryBonus = 20_000;
  } else if (
    (expected.startsWith('ga ') || expected.endsWith(' railway station')) &&
    osmKey === 'railway' &&
    osmValue === 'station'
  ) {
    categoryBonus = 20_000;
  } else if (
    (expected.startsWith('benh vien ') || expected.endsWith(' hospital')) &&
    osmValue === 'hospital'
  ) {
    categoryBonus = 20_000;
  }

  const expectedTokens = new Set(expected.split(' '));
  const nameScore = Math.max(
    ...candidates.map((candidate) => {
      if (candidate === expected) return 10_000;
      if (candidate.includes(expected)) {
        return 5_000 - (candidate.length - expected.length);
      }
      if (expected.includes(candidate)) {
        return 4_000 - (expected.length - candidate.length);
      }
      const candidateTokens = new Set(candidate.split(' '));
      const matchingTokens = [...expectedTokens].filter((token) =>
        candidateTokens.has(token),
      ).length;
      return (matchingTokens / expectedTokens.size) * 1_000;
    }),
  );
  return categoryBonus + nameScore;
}

async function searchNominatim(location: string) {
  const baseUrl =
    serverEnv('GEOCODER_BASE_URL') ??
    'https://nominatim.openstreetmap.org/search';
  const searchUrl = new URL(baseUrl);
  searchUrl.searchParams.set('q', `${location}, Vinh, Nghe An, Vietnam`);
  searchUrl.searchParams.set('format', 'jsonv2');
  searchUrl.searchParams.set('limit', '1');
  searchUrl.searchParams.set('addressdetails', '1');
  searchUrl.searchParams.set('countrycodes', 'vn');
  searchUrl.searchParams.set('viewbox', VINH_VIEWBOX);
  searchUrl.searchParams.set('bounded', '1');

  const response = await throttledFetch(searchUrl);
  if (!response.ok) throw new Error(`Nominatim returned ${response.status}.`);
  const results = (await response.json()) as NominatimResult[];
  const first = results[0];
  const coordinates = parseCoordinates([first?.lon, first?.lat]);
  if (!coordinates) return null;
  return {
    coordinates,
    displayName:
      typeof first?.display_name === 'string'
        ? first.display_name
        : `${location}, Vinh City, Vietnam`,
    provider: 'nominatim' as const,
    attribution: '© OpenStreetMap contributors',
  };
}

async function searchPhoton(location: string) {
  const baseUrl =
    serverEnv('PHOTON_BASE_URL') ?? 'https://photon.komoot.io/api/';
  const searchUrl = new URL(baseUrl);
  searchUrl.searchParams.set('q', location);
  searchUrl.searchParams.set('limit', '5');
  searchUrl.searchParams.set('bbox', VINH_BBOX);
  searchUrl.searchParams.set('countrycode', 'VN');
  searchUrl.searchParams.set('lang', 'en');

  const response = await throttledFetch(searchUrl);
  if (!response.ok) throw new Error(`Photon returned ${response.status}.`);
  const body = (await response.json()) as PhotonResponse;
  const rankedFeatures = [...(body.features ?? [])].sort(
    (left, right) =>
      photonMatchScore(right, location) - photonMatchScore(left, location),
  );
  for (const feature of rankedFeatures) {
    const coordinates = parseCoordinates(feature.geometry?.coordinates);
    if (!coordinates) continue;
    return {
      coordinates,
      displayName: photonDisplayName(
        feature,
        `${location}, Vinh City, Vietnam`,
      ),
      provider: 'photon' as const,
      attribution: '© OpenStreetMap contributors',
    };
  }
  return null;
}

function isWithinVinh(longitude: number, latitude: number) {
  return (
    longitude >= 105.55 &&
    longitude <= 105.82 &&
    latitude >= 18.55 &&
    latitude <= 18.82
  );
}

export async function POST(request: Request) {
  let body: GeocodeBody;
  try {
    body = (await request.json()) as GeocodeBody;
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const location = normalizeLocation(body.location);
  if (
    location.length < 2 ||
    /^(unknown|location not established|not established)$/i.test(location)
  ) {
    return Response.json(
      { error: 'A specific incident location is required.' },
      { status: 400 },
    );
  }

  const key = cacheKey(location);
  const cached = geocodeCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return Response.json({ available: Boolean(cached.value), ...cached.value });
  }

  try {
    const variants = searchVariants(location);
    let value: GeocodeResult | null = null;

    try {
      value = await searchNominatim(variants[0]);
    } catch {
      // The second provider below keeps a transient Nominatim outage from
      // preventing incident discovery during a local exercise.
    }

    for (const variant of variants) {
      if (value) break;
      try {
        value = await searchPhoton(variant);
      } catch {
        // Continue to other query variants; the route reports failure only
        // after every safe, bounded lookup has been exhausted.
      }
    }

    if (!value) {
      geocodeCache.set(key, {
        expiresAt: Date.now() + CACHE_TTL_MS,
        value: null,
      });
      return Response.json({ available: false });
    }

    geocodeCache.set(key, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      value,
    });
    return Response.json({ available: true, ...value });
  } catch {
    return Response.json(
      { error: 'The location could not be geocoded.' },
      { status: 502 },
    );
  }
}
