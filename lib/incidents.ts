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

export type ReasoningEventKind =
  | 'observation'
  | 'inference'
  | 'memory_create'
  | 'memory_update'
  | 'uncertainty'
  | 'action_proposal';

export type ReasoningEvent = {
  kind: ReasoningEventKind;
  title: string;
  detail: string;
  evidence: string;
};

export type IncidentAnalysis = {
  incident: IncidentSnapshot;
  reasoningEvents: ReasoningEvent[];
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
          { speaker: 'operator', text: 'Vinh emergency coordination. Tell me what is happening and where you are.' },
          { speaker: 'reporter', text: 'I am on the Vinh side of Ben Thuy Bridge 1, just before the northern approach. Water is coming across the road very quickly. I had to stop because a motorbike has stalled ahead of me.' },
          { speaker: 'operator', text: 'Stay where the ground is dry and do not enter the water. How many people are with the motorbike, and can they move away from it safely?' },
          { speaker: 'reporter', text: 'There are two people, a man and a woman. They have stepped back toward the higher pavement. Neither looks injured, but the water is already around the bottom of the bike.' },
          { speaker: 'operator', text: 'Good. Keep them off the roadway. Can you tell whether the water is still rising, and is any vehicle trying to cross?' },
          { speaker: 'reporter', text: 'Yes, it is definitely higher than when I arrived a few minutes ago. One small car turned around. A delivery van is stopped farther back, so nobody is crossing now.' },
          { speaker: 'operator', text: 'Understood. Remain behind the stopped vehicles. I am marking the northern approach as unsafe and passing the report to the road and water-rescue teams.' },
          { speaker: 'reporter', text: 'All right. We will stay here on the dry side. I can call again if the water reaches the pavement.' },
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
          { speaker: 'field', text: 'Coordination, Road Team 3. We are now at the northern approach to Ben Thuy Bridge 1 on the Vinh side.' },
          { speaker: 'operator', text: 'Road Team 3, received. Give me a measured depth, road access, and whether anyone remains inside the flooded section.' },
          { speaker: 'field', text: 'The marker reads approximately thirty-five centimetres at the center line. The water is moving across both lanes. We have checked the visible roadway and no person is inside the water.' },
          { speaker: 'operator', text: 'Confirm the route status and whether your barriers are on stable ground.' },
          { speaker: 'field', text: 'The route is impassable. Two barriers are in place about eighty metres north of the water edge, both on dry pavement. Police are turning vehicles around.' },
          { speaker: 'operator', text: 'Any damage to the bridge approach, exposed power, or fuel leakage from the stalled motorbike?' },
          { speaker: 'field', text: 'No visible road-surface damage and no power hazard. The motorbike has been moved onto the pavement. We do not see a fuel sheen.' },
          { speaker: 'operator', text: 'Copy. Maintain the closure, repeat the depth check in ten minutes, and report immediately if the edge reaches the barrier line.' },
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
          { speaker: 'operator', text: 'Vinh emergency coordination. What is the address of the emergency?' },
          { speaker: 'reporter', text: 'This is the manager at Vinh Market. Floodwater is entering through the eastern entrance, the side facing the loading street. It started as a thin flow, but now it is spreading into the first hall.' },
          { speaker: 'operator', text: 'Move everyone away from the entrance. How many people are still inside, and is anyone unable to walk?' },
          { speaker: 'reporter', text: 'Six traders are with me. Everyone can walk and nobody is injured. We are moving toward the raised interior hall, but one older man needs a little help.' },
          { speaker: 'operator', text: 'Is there electricity near the water or any damaged equipment?' },
          { speaker: 'reporter', text: 'There is a power cabinet just inside the eastern entrance. The water has not reached it yet, maybe two or three metres away, but I do not know whether that circuit is still live.' },
          { speaker: 'operator', text: 'Do not approach or touch the cabinet. Keep the group together in the raised hall. Can responders reach you from the western entrance?' },
          { speaker: 'reporter', text: 'Yes, the western entrance is still dry from what I can see. I will send one staff member only as far as the inside doorway to guide them, not outside.' },
          { speaker: 'operator', text: 'That is understood. I am requesting utility isolation and a controlled evacuation through the western side. Call back immediately if the water reaches the cabinet.' },
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
          { speaker: 'operator', text: 'Vinh emergency coordination. Go ahead with your shelter update.' },
          { speaker: 'reporter', text: 'This is the facilities coordinator at Vinh University. The sports hall has been inspected and we can open it as a temporary shelter for people displaced by the flooding.' },
          { speaker: 'operator', text: 'What is the safe capacity, and which entrance should transport teams use?' },
          { speaker: 'reporter', text: 'We can receive one hundred and twenty people immediately. The western gate and the road to the sports hall are clear. The southern service gate has standing water, so vehicles should avoid it.' },
          { speaker: 'operator', text: 'Do you have lighting, drinking water, toilets, and a place for basic medical screening?' },
          { speaker: 'reporter', text: 'Yes. Backup lighting is working, drinking water is available, and the toilets are open. We can use the first-aid room beside the main court for screening.' },
          { speaker: 'operator', text: 'Any accessibility issue for older residents or wheelchair users?' },
          { speaker: 'reporter', text: 'The western gate is level, and we have two staff members ready with wheelchairs. I need an estimated arrival time before we prepare registration.' },
          { speaker: 'operator', text: 'Copy. Record the shelter as available for one hundred and twenty people via the western gate. We will call before the first transport leaves.' },
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
          { speaker: 'field', text: 'Coordination, utility response team at Vinh Market. We are at the western service point and have isolated the circuit feeding the eastern entrance cabinet.' },
          { speaker: 'operator', text: 'Confirm the isolation is locked out and tell me whether you have tested the cabinet area.' },
          { speaker: 'field', text: 'The circuit is locked out and tagged. We tested from the dry boundary; no live voltage is detected at the cabinet or the adjacent metal shutter.' },
          { speaker: 'operator', text: 'Is the water still moving toward the cabinet, and can the evacuation team use the western route safely?' },
          { speaker: 'field', text: 'The water is still moving slowly into the eastern hall. The western corridor remains dry and is safe for a controlled exit. We have marked a no-entry line around the cabinet.' },
          { speaker: 'operator', text: 'Any other energized equipment or underground service that has not been isolated?' },
          { speaker: 'field', text: 'The refrigeration circuit in the north hall is on a separate supply and remains live, but the water is not near it. We recommend keeping that hall closed until the water trend is confirmed.' },
          { speaker: 'operator', text: 'Received. Maintain the electrical perimeter and coordinate directly with the evacuation lead. Report any change in water direction or voltage test.' },
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
          { speaker: 'operator', text: 'Vinh emergency coordination. Tell me what has happened at the market.' },
          { speaker: 'reporter', text: 'A section of roofing has lifted from the eastern hall at Vinh Market. Pieces are dropping into the loading street whenever the wind gusts. We have moved away from the doors.' },
          { speaker: 'operator', text: 'Keep everyone inside and away from windows. How many people are with you, and is anyone injured?' },
          { speaker: 'reporter', text: 'Six traders are in the interior hall with me. Nobody is injured. One person was frightened by falling glass, but the glass did not hit her.' },
          { speaker: 'operator', text: 'Do you see any electrical cable or fire near the damaged entrance?' },
          { speaker: 'reporter', text: 'A cable is hanging beside the metal shutter. I cannot tell if it is a power line. There is no fire or smoke, and nobody is going near it.' },
          { speaker: 'operator', text: 'Good. Treat it as live. Stay in the interior hall and use the western exit only if responders direct you. I am sending the electrical and civil-defence report now.' },
          { speaker: 'reporter', text: 'Understood. We will remain inside together. The western corridor is clear at the moment.' },
        ],
      },
      {
        id: 'storm-call-02', title: 'Civil defence · market perimeter', source: 'FIELD RADIO · 00:24', locationId: 'market', priority: 'urgent',
        turns: [
          { speaker: 'field', text: 'Coordination, civil-defence unit at Vinh Market. We have established a perimeter around the eastern loading street.' },
          { speaker: 'operator', text: 'Confirm the active hazards, public access, and the status of the six people inside.' },
          { speaker: 'field', text: 'Loose roofing remains overhead, and debris is still moving during gusts. The street is closed to pedestrians. The six occupants are visible through the interior corridor and report no injuries.' },
          { speaker: 'operator', text: 'Has the hanging cable been isolated, and do you have a safe evacuation path?' },
          { speaker: 'field', text: 'The utility team is testing it now, so we are still treating it as energized. The western entrance is protected from the wind and appears usable.' },
          { speaker: 'operator', text: 'Do not move the occupants until utility isolation is confirmed. Can the roof technician approach from the western side?' },
          { speaker: 'field', text: 'Yes, but only under cover. We have a sheltered staging point twenty metres west of the entrance and will hold there.' },
          { speaker: 'operator', text: 'Received. Maintain the perimeter, then conduct a controlled evacuation through the western corridor after the utility clearance.' },
        ],
      },
      {
        id: 'storm-call-03', title: 'Railway station · roof damage', source: 'MOBILE · 00:29', locationId: 'station', priority: 'elevated',
        turns: [
          { speaker: 'operator', text: 'Vinh emergency coordination. What is the situation at the railway station?' },
          { speaker: 'reporter', text: 'I am the duty supervisor at Vinh Railway Station. Branches have fallen across the forecourt, and a piece of the taxi-canopy roof is loose and striking the frame in the wind.' },
          { speaker: 'operator', text: 'Keep passengers away from the forecourt. How many people are in the station, and are there any injuries?' },
          { speaker: 'reporter', text: 'About forty passengers are inside the main concourse. Nobody is injured. We have stopped people from leaving through the front doors.' },
          { speaker: 'operator', text: 'Are trains moving, and is there another safe exit for emergency access?' },
          { speaker: 'reporter', text: 'Arriving trains are being held outside Vinh for now. The southern staff gate is clear, but it is narrow and should only be used by responders.' },
          { speaker: 'operator', text: 'Understood. Keep the public in the concourse, reserve the southern gate for response teams, and report immediately if the canopy separates from its frame.' },
          { speaker: 'reporter', text: 'Copy. Security is watching the doors, and I will update you if the roof condition changes.' },
        ],
      },
      {
        id: 'storm-call-04', title: 'University shelter coordinator', source: 'LANDLINE · 00:33', locationId: 'university', priority: 'routine',
        turns: [
          { speaker: 'operator', text: 'Vinh emergency coordination. Please give me the university shelter status.' },
          { speaker: 'reporter', text: 'The Vinh University sports hall is staffed and ready. We can receive people displaced by the storm, but the tree-lined southern road is not safe because branches are falling.' },
          { speaker: 'operator', text: 'What capacity can you support tonight, and which approach is clear?' },
          { speaker: 'reporter', text: 'We can support one hundred and twenty people. The western gate is clear, and vehicles can reach the hall without passing under large trees.' },
          { speaker: 'operator', text: 'Do you have power, water, and a protected unloading area?' },
          { speaker: 'reporter', text: 'Mains power is on and the generator has been tested. Water and toilets are available. The covered court entrance can be used for unloading.' },
          { speaker: 'operator', text: 'Record the southern road as unsafe. Prepare registration for a possible first group from Vinh Market, but wait for our transport confirmation.' },
          { speaker: 'reporter', text: 'Understood. Staff will use the western gate only and wait for your call before receiving transport.' },
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
          { speaker: 'operator', text: 'Vinh emergency coordination. Tell me where you are and what has happened.' },
          { speaker: 'reporter', text: 'I am driving a minibus on the access road below Nui Quyet. Soil and rocks came down in front of us after the heavy rain. The road is completely covered, so I stopped before the debris.' },
          { speaker: 'operator', text: 'Keep everyone inside the vehicle for now. How many people are on board, and is anyone injured?' },
          { speaker: 'reporter', text: 'There are eight passengers and me. Nobody is injured. Everyone has a seat belt on, but people are nervous because small stones are still coming down.' },
          { speaker: 'operator', text: 'Is the minibus on level ground, and is there any debris behind you preventing a safe reverse?' },
          { speaker: 'reporter', text: 'We are on a level section. The road behind us looks clear for about one hundred metres, but the rain is heavy and I do not want to move without guidance.' },
          { speaker: 'operator', text: 'That is correct. Do not drive closer to the slide and do not let anyone leave. Switch on hazard lights and wait for the field team to identify a safe direction.' },
          { speaker: 'reporter', text: 'Understood. We are staying inside with the engine off and the hazard lights on.' },
        ],
      },
      {
        id: 'landslide-call-02', title: 'Survey Team 2 · slope assessment', source: 'FIELD RADIO · 00:23', locationId: 'mountain', priority: 'urgent',
        turns: [
          { speaker: 'field', text: 'Coordination, Survey Team 2 at the lower Nui Quyet access road. We have visual contact with the slide and the stopped minibus.' },
          { speaker: 'operator', text: 'Give me the slide dimensions, current movement, and whether you can reach the vehicle safely.' },
          { speaker: 'field', text: 'The debris covers roughly sixty metres of roadway and appears two to three metres deep at the center. Small stones are still falling from the upper face.' },
          { speaker: 'operator', text: 'Is either side passable on foot, and what is the status of the passengers?' },
          { speaker: 'field', text: 'Neither side is safe to cross. We contacted the driver by phone. Nine people total are in the minibus, including the driver, with no injuries reported.' },
          { speaker: 'operator', text: 'Can the vehicle reverse away from the runout zone without entering another hazard?' },
          { speaker: 'field', text: 'Possibly, but we have not inspected the road behind it. We recommend holding position until the upper slope is checked and a spotter can approach from above.' },
          { speaker: 'operator', text: 'Copy. Record the road as impassable, keep all responders below the exclusion line, and request a geotechnical assessment.' },
        ],
      },
      {
        id: 'landslide-call-03', title: 'Ward team · alternate route', source: 'RADIO · 00:26', locationId: 'university', priority: 'elevated',
        turns: [
          { speaker: 'field', text: 'Coordination, ward response team. We have checked the alternate road approaching Nui Quyet from the university side.' },
          { speaker: 'operator', text: 'Describe the road condition and whether it reaches the minibus without crossing the unstable slope.' },
          { speaker: 'field', text: 'The lower section is clear, but the final bend passes beneath the same saturated hillside. We found fresh mud on the drainage edge and have stopped before that point.' },
          { speaker: 'operator', text: 'Do not advance. Are residents or sightseers entering that road behind you?' },
          { speaker: 'field', text: 'Two motorbikes tried to enter, but we turned them around. We now have cones and one vehicle blocking the junction.' },
          { speaker: 'operator', text: 'Good. Keep the alternate approach closed until the geotechnical unit evaluates the shared slope. Can emergency vehicles stage at your junction?' },
          { speaker: 'field', text: 'Yes. There is dry space for three response vehicles without blocking local traffic.' },
          { speaker: 'operator', text: 'Received. Mark that junction as the staging point, not an access route, and maintain the public closure.' },
        ],
      },
      {
        id: 'landslide-call-04', title: 'Geotechnical unit · stability check', source: 'FIELD RADIO · 00:31', locationId: 'mountain', priority: 'urgent',
        turns: [
          { speaker: 'field', text: 'Coordination, geotechnical unit at the Nui Quyet lower observation point. We can see fresh cracks above the slide crown.' },
          { speaker: 'operator', text: 'Confirm whether movement is continuing and whether any responder can approach the minibus.' },
          { speaker: 'field', text: 'Minor movement is continuing along the eastern edge, especially during heavy rain. No responder should enter the runout zone at this time.' },
          { speaker: 'operator', text: 'Is the minibus itself inside the predicted runout path?' },
          { speaker: 'field', text: 'It is near the western margin. It is not currently struck by debris, but a larger secondary failure could reach its position.' },
          { speaker: 'operator', text: 'What is the safest immediate option for the occupants?' },
          { speaker: 'field', text: 'Keep them inside while we inspect the road behind the vehicle from the upper junction. If that route is clear, a controlled reverse is safer than a foot evacuation.' },
          { speaker: 'operator', text: 'Understood. Maintain the exclusion zone and report when the reverse route has been inspected. No approach is authorized yet.' },
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

export function isIncidentAnalysis(value: unknown): value is IncidentAnalysis {
  if (!value || typeof value !== 'object') return false;
  const analysis = value as Partial<IncidentAnalysis>;
  const kinds = new Set<ReasoningEventKind>([
    'observation',
    'inference',
    'memory_create',
    'memory_update',
    'uncertainty',
    'action_proposal',
  ]);
  return (
    isIncidentSnapshot(analysis.incident) &&
    Array.isArray(analysis.reasoningEvents) &&
    analysis.reasoningEvents.length >= 1 &&
    analysis.reasoningEvents.length <= 6 &&
    analysis.reasoningEvents.every(
      (event) =>
        Boolean(event) &&
        typeof event === 'object' &&
        kinds.has(event.kind) &&
        nonempty(event.title) &&
        nonempty(event.detail) &&
        nonempty(event.evidence),
    )
  );
}

function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
