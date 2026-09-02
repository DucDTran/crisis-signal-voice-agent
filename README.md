# CrisisSignal

CrisisSignal is a multi-hazard voice-to-command demonstration localized to Vinh City, Vietnam. It combines live AssemblyAI transcription, structured incident extraction, a shared map, source-linked briefings, and human-authorized response actions.

All incidents, measurements, casualties, timestamps, and responses in the scripted scenarios are fictional. Real Vinh landmarks are used only to make the hackathon demonstration understandable. The app never contacts or dispatches a real emergency service.

## Demonstration modes

### Deterministic scenarios

Choose **Flood**, **Storm**, or **Landslide**, then select **Run scenario**. Each exercise streams a public report followed by a field-team report while the transcript, incident memory, map, command briefing, and recommended actions update automatically.

- **Flood:** 35 cm of moving water at Ben Thuy Bridge 1; route closure, disaster-command notification, canoe standby, and public warning.
- **Tropical storm:** damaged roofing and an electrical hazard at Vinh Market; utility isolation, controlled evacuation, and technical assessment.
- **Landslide:** a 60 m unstable slide on the Nui Quyet access road; route closure, technical assessment, and targeted evacuation.

The scripted reports use browser speech synthesis, so these scenarios remain reliable if microphone permission, venue Wi-Fi, or an external API is unavailable.

### Live incident intake

Select **Start live incident** and speak an English emergency report. The live path is:

1. Microphone audio becomes 16 kHz mono PCM16.
2. AssemblyAI Universal-3 Pro Streaming returns partial and finalized transcript turns.
3. Each cumulative finalized transcript is sent server-side to AssemblyAI LLM Gateway.
4. The analyzer returns a constrained incident record: hazard, location, summary, severity, confidence, measurement, access, trend, people at risk, injuries, and recommended action IDs.
5. The dashboard updates the incident memory, map, briefing, and guarded action queue.

The analyzer supports flood, tropical storm, landslide, earthquake, wildfire, building collapse, other hazards, and unknown reports. Missing evidence stays **Unknown**. A malformed or incomplete analyzer response is rejected before it can update the interface.

## Response authorization

AI recommendations are proposals only. Every simulated call or dispatch requires a separate operator confirmation dialog. Confirming an action records **Simulated dispatch sent** in local interface state; it does not call a phone number, send a message, or contact an agency.

The action catalog includes:

- Call disaster prevention command
- Dispatch rescue canoes
- Dispatch a medical team
- Close an affected access route
- Begin targeted evacuation
- Dispatch technical assessment
- Request utility isolation
- Issue a public safety alert

## Vinh City map

The app uses OpenStreetMap raster tiles and tracks:

- Ben Thuy Bridge 1
- Vinh Railway Station
- Vinh Market
- Vinh University
- Nui Quyet

Map impact areas and measurement labels are illustrative. They are not live geospatial data.

## AssemblyAI configuration

Copy the example environment file and add a standard AssemblyAI project API key:

```bash
cp .env.example .env
```

```dotenv
ASSEMBLYAI_API_KEY=your_server_side_key
ASSEMBLYAI_LLM_MODEL=qwen3.5-4b-32k-fast
```

The key stays in the ignored server-side `.env` file. The browser receives a 60-second, single-use Streaming token rather than the permanent key.

`qwen3.5-4b-32k-fast` is the default analyzer because it is available through AssemblyAI-hosted LLM Gateway projects. You can change `ASSEMBLYAI_LLM_MODEL` to another model enabled for your AssemblyAI project. The current Qwen path uses schema-in-prompt JSON, AssemblyAI JSON repair, and strict application-side validation because this model does not accept the Gateway `response_format` parameter.

The integration uses:

- `GET https://streaming.assemblyai.com/v3/token`
- `wss://streaming.assemblyai.com/v3/ws`
- `speech_model=u3-rt-pro`
- Streaming key-term prompting for Vinh landmarks and response terminology
- `POST https://llm-gateway.assemblyai.com/v1/chat/completions`
- An explicit `Terminate` event when a streaming session ends

## Local development

```bash
npm install
npm run dev
```

For a production-style local preview with the `.env` bindings:

```bash
npm run build
npm run start:local
```

Quality checks:

```bash
npm run lint
npm run build
```

## Safeguards

- Credentials and LLM requests remain server-side.
- Permanent API keys are never sent to the browser.
- Only finalized transcript turns trigger incident analysis.
- Missing facts remain unknown; the analyzer is explicitly prohibited from inventing measurements, casualties, access status, responders, or locations.
- Structured incident responses are validated before state changes.
- Canoes can only be recommended for floodwater rescue or evacuation.
- All external calls and dispatches are simulated and require human authorization.
- Deterministic scenarios remain available as an offline fallback.
