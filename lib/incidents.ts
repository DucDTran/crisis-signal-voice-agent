export type ScenarioId = 'flood' | 'storm' | 'landslide';

export type HazardType =
  | 'flood'
  | 'tropical_storm'
  | 'landslide'
  | 'earthquake'
  | 'wildfire'
  | 'building_collapse'
  | 'other'
  | 'unknown';

export type LocationId =
  | 'bridge'
  | 'station'
  | 'market'
  | 'university'
  | 'mountain'
  | 'unknown';

export type Severity = 'low' | 'moderate' | 'high' | 'critical' | 'unknown';
export type Confidence = 'low' | 'medium' | 'high';
export type AccessState = 'passable' | 'restricted' | 'impassable' | 'unknown';

export type ActionId =
  | 'notify_disaster_command'
  | 'dispatch_rescue_canoes'
  | 'dispatch_medical_team'
  | 'close_access_route'
  | 'evacuate_area'
  | 'dispatch_technical_team'
  | 'request_utility_shutdown'
  | 'issue_public_alert';

export type IncidentSnapshot = {
  hazardType: HazardType;
  locationId: LocationId;
  locationName: string;
  summary: string;
  severity: Severity;
  confidence: Confidence;
  metricLabel: string;
  metricValue: string;
  access: AccessState;
  trend: string;
  peopleAtRisk: string;
  injuries: string;
  recommendedActionIds: ActionId[];
};

export type ScenarioReport = {
  id: 'public' | 'field';
  title: string;
  source: string;
  text: string;
};

export type ConversationTurn = {
  speaker: 'reporter' | 'operator' | 'field';
  text: string;
};

export type ScenarioCall = {
  id: string;
  title: string;
  source: string;
  locationId: LocationId;
  priority: 'routine' | 'elevated' | 'urgent';
  audioUrl?: string;
  turns: ConversationTurn[];
};

export type Scenario = {
  id: ScenarioId;
  name: string;
  shortName: string;
  exerciseTitle: string;
  incident: IncidentSnapshot;
  publicReport: ScenarioReport;
  fieldReport: ScenarioReport;
  operatorPrompt: string;
  calls: ScenarioCall[];
  briefing: string;
};

export type ActionDefinition = {
  id: ActionId;
  title: string;
  team: string;
  description: string;
};

export const actionCatalog: Record<ActionId, ActionDefinition> = {
  notify_disaster_command: {
    id: 'notify_disaster_command',
    title: 'Call disaster prevention command',
    team: 'Vinh City command duty officer',
    description:
      'Share the source-linked incident briefing and request coordination.',
  },
  dispatch_rescue_canoes: {
    id: 'dispatch_rescue_canoes',
    title: 'Dispatch rescue canoes',
    team: 'Water rescue unit',
    description:
      'Stage shallow-draft rescue craft outside the affected access route.',
  },
  dispatch_medical_team: {
    id: 'dispatch_medical_team',
    title: 'Dispatch medical team',
    team: 'Emergency medical response',
    description:
      'Prepare triage support at the designated safe staging location.',
  },
  close_access_route: {
    id: 'close_access_route',
    title: 'Close affected access route',
    team: 'Traffic and road safety unit',
    description:
      'Establish a controlled perimeter and publish the route restriction.',
  },
  evacuate_area: {
    id: 'evacuate_area',
    title: 'Begin targeted evacuation',
    team: 'Ward response teams',
    description: 'Move exposed residents to the nearest safe assembly point.',
  },
  dispatch_technical_team: {
    id: 'dispatch_technical_team',
    title: 'Dispatch technical assessment',
    team: 'Infrastructure and geotechnical unit',
    description:
      'Assess structural, slope, road, and debris hazards before reopening.',
  },
  request_utility_shutdown: {
    id: 'request_utility_shutdown',
    title: 'Request utility isolation',
    team: 'Electricity and utilities liaison',
    description:
      'Isolate exposed power infrastructure within the incident perimeter.',
  },
  issue_public_alert: {
    id: 'issue_public_alert',
    title: 'Issue public safety alert',
    team: 'Public information officer',
    description:
      'Publish a concise warning with location, hazard, and route guidance.',
  },
};

export const scenarios: Record<ScenarioId, Scenario> = {
  flood: {
    id: 'flood',
    name: 'River flood and road inundation',
    shortName: 'Flood',
    exerciseTitle: 'Ben Thuy flood response exercise',
    publicReport: {
      id: 'public',
      title: 'Public call 01',
      source: 'MOBILE · 00:18',
      text: 'I am near Ben Thuy Bridge 1 on the Vinh side. Water is crossing the northern approach. I passed about five minutes ago. It still appears to be rising, but I cannot estimate the depth.',
    },
    fieldReport: {
      id: 'field',
      title: 'Road Team 3 radio',
      source: 'FIELD RADIO · 00:21',
      text: 'Road Team 3 reporting to coordination. At 11:18, moving water on the northern approach to Ben Thuy Bridge 1 is approximately 35 centimetres deep. The route is impassable. Barriers are in place. No road surface damage is visible.',
    },
    operatorPrompt:
      'Operator: I have your location at Ben Thuy Bridge 1. Can you confirm whether anyone is trapped or needs immediate rescue, and whether the water is still rising?',
    calls: [
      {
        id: 'flood-call-01',
        title: 'Resident · Ben Thuy Bridge 1',
        source: 'MOBILE · 00:18',
        locationId: 'bridge',
        priority: 'urgent',
        audioUrl: '/audio/vinh/flood-call-01.wav',
        turns: [
          { speaker: 'reporter', text: 'I am near Ben Thuy Bridge 1 on the Vinh side. Water is crossing the northern approach.' },
          { speaker: 'operator', text: 'I have your location. Are you with anyone, and is the water still rising?' },
          { speaker: 'reporter', text: 'Two people are near a stalled motorbike. It is rising, but I cannot estimate the depth.' },
        ],
      },
      {
        id: 'flood-call-02',
        title: 'Road Team 3 · northern approach',
        source: 'FIELD RADIO · 00:21',
        locationId: 'bridge',
        priority: 'urgent',
        audioUrl: '/audio/vinh/flood-call-02.wav',
        turns: [
          { speaker: 'field', text: 'Road Team 3 reporting to coordination. We are at the northern approach.' },
          { speaker: 'operator', text: 'Confirm depth, access, and whether the barriers are holding.' },
          { speaker: 'field', text: 'Approximately 35 centimetres of moving water. The route is impassable and barriers are in place.' },
        ],
      },
      {
        id: 'flood-call-03',
        title: 'Market manager · eastern entrance',
        source: 'MOBILE · 00:24',
        locationId: 'market',
        priority: 'elevated',
        audioUrl: '/audio/vinh/flood-call-03.wav',
        turns: [
          { speaker: 'reporter', text: 'Water is entering the eastern entrance of Vinh Market. Traders are sheltering inside.' },
          { speaker: 'operator', text: 'How many people are inside, and do you see any electrical danger?' },
          { speaker: 'reporter', text: 'Six people. A power cabinet is exposed near the entrance.' },
        ],
      },
      {
        id: 'flood-call-04',
        title: 'University shelter coordinator',
        source: 'LANDLINE · 00:27',
        locationId: 'university',
        priority: 'elevated',
        audioUrl: '/audio/vinh/flood-call-04.wav',
        turns: [
          { speaker: 'reporter', text: 'Vinh University can open the sports hall as a temporary shelter.' },
          { speaker: 'operator', text: 'How many people can you receive and when can the hall open?' },
          { speaker: 'reporter', text: 'We can receive 120 people immediately.' },
        ],
      },
      {
        id: 'flood-call-05',
        title: 'Utility team · power isolation',
        source: 'FIELD RADIO · 00:31',
        locationId: 'market',
        priority: 'urgent',
        audioUrl: '/audio/vinh/flood-call-05.wav',
        turns: [
          { speaker: 'field', text: 'Utility team confirms the exposed market circuit is isolated.' },
          { speaker: 'operator', text: 'Confirm the perimeter remains closed while the water is moving.' },
          { speaker: 'field', text: 'Confirmed. No live voltage detected at the eastern entrance.' },
        ],
      },
    ],
    incident: {
      hazardType: 'flood',
      locationId: 'bridge',
      locationName: 'Ben Thuy Bridge 1, northern approach',
      summary:
        'Moving floodwater is crossing the northern bridge approach. The route is impassable and barriers are in place.',
      severity: 'high',
      confidence: 'high',
      metricLabel: 'Water level',
      metricValue: '35 cm',
      access: 'impassable',
      trend: 'Rising',
      peopleAtRisk: 'Unknown',
      injuries: 'None reported',
      recommendedActionIds: [
        'notify_disaster_command',
        'close_access_route',
        'dispatch_rescue_canoes',
        'issue_public_alert',
      ],
    },
    briefing:
      'Ben Thuy Bridge 1 is impassable on the northern approach. Road Team 3 reports approximately 35 centimetres of moving water with barriers in place. Notify disaster command, keep rescue canoes on standby, and route responders through a confirmed alternate approach.',
  },
  storm: {
    id: 'storm',
    name: 'Tropical storm damage',
    shortName: 'Storm',
    exerciseTitle: 'Vinh Market storm response exercise',
    publicReport: {
      id: 'public',
      title: 'Market manager call',
      source: 'MOBILE · 00:20',
      text: 'This is the manager at Vinh Market. Strong wind has torn roofing from the eastern hall and debris is falling into the street. Several traders are sheltering inside and I can see a power line hanging near the entrance.',
    },
    fieldReport: {
      id: 'field',
      title: 'Civil defence radio',
      source: 'FIELD RADIO · 00:24',
      text: 'Civil defence unit at Vinh Market. The eastern entrance is unsafe and restricted. Six people are sheltering in the interior hall with no injuries reported. The utility hazard is isolated but technical assessment and controlled evacuation are required.',
    },
    operatorPrompt:
      'Operator: I have the market entrance marked. Please move away from the hanging line and confirm how many people are sheltering inside while the field team approaches.',
    calls: [
      {
        id: 'storm-call-01', title: 'Market manager · eastern hall', source: 'MOBILE · 00:20', locationId: 'market', priority: 'urgent',
        turns: [
          { speaker: 'reporter', text: 'Strong wind has torn roofing from the eastern hall and debris is falling into the street.' },
          { speaker: 'operator', text: 'Move away from the entrance. How many people are sheltering inside?' },
          { speaker: 'reporter', text: 'Six traders are inside, and a power line is hanging near the entrance.' },
        ],
      },
      {
        id: 'storm-call-02', title: 'Civil defence · market perimeter', source: 'FIELD RADIO · 00:24', locationId: 'market', priority: 'urgent',
        turns: [
          { speaker: 'field', text: 'Civil defence unit at Vinh Market. The eastern entrance is unsafe and restricted.' },
          { speaker: 'operator', text: 'Confirm injuries and whether the utility hazard is isolated.' },
          { speaker: 'field', text: 'No injuries reported. Utility hazard is isolated; controlled evacuation is required.' },
        ],
      },
      {
        id: 'storm-call-03', title: 'Railway station · roof damage', source: 'MOBILE · 00:29', locationId: 'station', priority: 'elevated',
        turns: [
          { speaker: 'reporter', text: 'The station forecourt has loose roofing and fallen branches. Trains are being held.' },
          { speaker: 'operator', text: 'Keep passengers inside the concourse and report any injuries.' },
          { speaker: 'reporter', text: 'No injuries. The forecourt remains closed.' },
        ],
      },
      {
        id: 'storm-call-04', title: 'University shelter coordinator', source: 'LANDLINE · 00:33', locationId: 'university', priority: 'routine',
        turns: [
          { speaker: 'reporter', text: 'The university sports hall is available for people displaced by the storm.' },
          { speaker: 'operator', text: 'Confirm capacity and access from the market.' },
          { speaker: 'reporter', text: 'Capacity is 120 people and the western gate is clear.' },
        ],
      },
    ],
    incident: {
      hazardType: 'tropical_storm',
      locationId: 'market',
      locationName: 'Vinh Market, eastern hall',
      summary:
        'Storm damage has created falling-debris and electrical hazards at the eastern market entrance. Six people are sheltering inside.',
      severity: 'high',
      confidence: 'high',
      metricLabel: 'People sheltered',
      metricValue: '6',
      access: 'restricted',
      trend: 'Wind damage active',
      peopleAtRisk: '6',
      injuries: 'None reported',
      recommendedActionIds: [
        'notify_disaster_command',
        'request_utility_shutdown',
        'evacuate_area',
        'dispatch_technical_team',
      ],
    },
    briefing:
      'Vinh Market has active storm damage at the eastern hall. Six people are sheltering inside, the entrance is restricted, and a utility hazard requires isolation. Coordinate a controlled evacuation and send a technical assessment team.',
  },
  landslide: {
    id: 'landslide',
    name: 'Landslide and blocked access',
    shortName: 'Landslide',
    exerciseTitle: 'Nui Quyet landslide response exercise',
    publicReport: {
      id: 'public',
      title: 'Driver emergency call',
      source: 'MOBILE · 00:17',
      text: 'I am on the access road below Nui Quyet. Soil and rocks have come down across the road after the rain. A minibus is stopped above the slide and the slope is still shedding small stones.',
    },
    fieldReport: {
      id: 'field',
      title: 'Survey Team 2 radio',
      source: 'FIELD RADIO · 00:23',
      text: 'Survey Team 2 at Nui Quyet access road. The landslide is about sixty metres across and the route is completely blocked. Eight people are isolated in the minibus with no injuries. The slope remains unstable and requires geotechnical assessment.',
    },
    operatorPrompt:
      'Operator: I have the Nui Quyet access road. Is the minibus stable, and can everyone remain inside while we establish a safe approach below the unstable slope?',
    calls: [
      {
        id: 'landslide-call-01', title: 'Driver · Nui Quyet access road', source: 'MOBILE · 00:17', locationId: 'mountain', priority: 'urgent',
        turns: [
          { speaker: 'reporter', text: 'Soil and rocks have come down across the road below Nui Quyet. A minibus is stopped above the slide.' },
          { speaker: 'operator', text: 'Can everyone remain inside, and is anyone injured?' },
          { speaker: 'reporter', text: 'Everyone is inside. The slope is still shedding small stones.' },
        ],
      },
      {
        id: 'landslide-call-02', title: 'Survey Team 2 · slope assessment', source: 'FIELD RADIO · 00:23', locationId: 'mountain', priority: 'urgent',
        turns: [
          { speaker: 'field', text: 'Survey Team 2 at Nui Quyet access road. The slide is approximately sixty metres across.' },
          { speaker: 'operator', text: 'Confirm access and the status of the isolated passengers.' },
          { speaker: 'field', text: 'Route is completely blocked. Eight people are isolated with no injuries.' },
        ],
      },
      {
        id: 'landslide-call-03', title: 'Ward team · alternate route', source: 'RADIO · 00:26', locationId: 'university', priority: 'elevated',
        turns: [
          { speaker: 'field', text: 'Ward team has identified an alternate approach from the university side.' },
          { speaker: 'operator', text: 'Hold the approach until the geotechnical team confirms it is safe.' },
          { speaker: 'field', text: 'Understood. Route remains held and marked.' },
        ],
      },
      {
        id: 'landslide-call-04', title: 'Geotechnical unit · stability check', source: 'FIELD RADIO · 00:31', locationId: 'mountain', priority: 'urgent',
        turns: [
          { speaker: 'field', text: 'Geotechnical unit reports ongoing movement on the upper slope.' },
          { speaker: 'operator', text: 'Confirm whether responders can approach the minibus.' },
          { speaker: 'field', text: 'No. Keep the perimeter closed until the slope stabilizes.' },
        ],
      },
    ],
    incident: {
      hazardType: 'landslide',
      locationId: 'mountain',
      locationName: 'Nui Quyet access road',
      summary:
        'An unstable landslide approximately 60 metres across is blocking the access road. Eight people are isolated in a minibus.',
      severity: 'high',
      confidence: 'high',
      metricLabel: 'Slide width',
      metricValue: '60 m',
      access: 'impassable',
      trend: 'Slope remains unstable',
      peopleAtRisk: '8',
      injuries: 'None reported',
      recommendedActionIds: [
        'notify_disaster_command',
        'close_access_route',
        'dispatch_technical_team',
        'evacuate_area',
      ],
    },
    briefing:
      'Nui Quyet access road is completely blocked by an unstable landslide approximately sixty metres across. Eight people are isolated in a minibus with no injuries reported. Close the route, notify command, and hold evacuation until the technical team confirms a safe approach.',
  },
};

export const hazardLabels: Record<HazardType, string> = {
  flood: 'Flood',
  tropical_storm: 'Tropical storm',
  landslide: 'Landslide',
  earthquake: 'Earthquake',
  wildfire: 'Wildfire',
  building_collapse: 'Building collapse',
  other: 'Other hazard',
  unknown: 'Hazard unknown',
};

export function isIncidentSnapshot(value: unknown): value is IncidentSnapshot {
  if (!value || typeof value !== 'object') return false;
  const incident = value as Partial<IncidentSnapshot>;
  const hazards = new Set<HazardType>([
    'flood',
    'tropical_storm',
    'landslide',
    'earthquake',
    'wildfire',
    'building_collapse',
    'other',
    'unknown',
  ]);
  const locations = new Set<LocationId>([
    'bridge',
    'station',
    'market',
    'university',
    'mountain',
    'unknown',
  ]);
  const severities = new Set<Severity>([
    'low',
    'moderate',
    'high',
    'critical',
    'unknown',
  ]);
  const confidences = new Set<Confidence>(['low', 'medium', 'high']);
  const accessStates = new Set<AccessState>([
    'passable',
    'restricted',
    'impassable',
    'unknown',
  ]);
  const actionIds = new Set<ActionId>(Object.keys(actionCatalog) as ActionId[]);
  return (
    hazards.has(incident.hazardType as HazardType) &&
    locations.has(incident.locationId as LocationId) &&
    nonempty(incident.locationName) &&
    nonempty(incident.summary) &&
    severities.has(incident.severity as Severity) &&
    confidences.has(incident.confidence as Confidence) &&
    nonempty(incident.metricLabel) &&
    nonempty(incident.metricValue) &&
    accessStates.has(incident.access as AccessState) &&
    nonempty(incident.trend) &&
    nonempty(incident.peopleAtRisk) &&
    nonempty(incident.injuries) &&
    Array.isArray(incident.recommendedActionIds) &&
    incident.recommendedActionIds.length <= 5 &&
    incident.recommendedActionIds.every((id) => actionIds.has(id))
  );
}

function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
