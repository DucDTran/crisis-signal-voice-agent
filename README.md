# FloodSignal

FloodSignal is a voice-to-map flood operations simulation localized to Vinh City, Vietnam. It turns public calls and field radio updates into a shared operational picture, while preserving human approval and a complete evidence trail.

Every flood condition, measurement, closure, timestamp, and response in this project is fictional. Real Vinh landmarks are used only to make the hackathon demonstration easy to understand.

## Demo flow

1. Start with a public report about possible flooding near the northern approach to Cầu Bến Thủy 1 / Ben Thuy Bridge 1.
2. Select **Process field update** to ingest a simulated Road Team 3 radio transmission.
3. Review the structured facts: 35 cm of moving water, an impassable route, and barriers in place.
4. Select **Verify and update map**. The incident marker, route state, metrics, and evidence timeline update together.
5. Select **Play route briefing**. The spoken response uses verified facts only and warns the operator not to route a relief vehicle across the bridge.
6. Use the reset button in the header to repeat the entire demonstration.

The play controls use the browser speech synthesizer for deterministic Vietnamese report replay and English briefing output. This makes the guided demo work without external credentials.

## Real Vinh landmarks

- Cầu Bến Thủy 1 / Ben Thuy Bridge 1
- Ga Vinh / Vinh Railway Station
- Chợ Vinh / Vinh Market
- Đại học Vinh / Vinh University

The map uses OpenFreeMap tiles with OpenStreetMap data. Landmark coordinates were resolved through OpenStreetMap Nominatim.

## AssemblyAI live Vietnamese transcription

The optional microphone mode uses AssemblyAI Streaming STT with `speech_model=whisper-rt`, which supports Vietnamese. The server mints a short-lived single-use token so the browser never receives the API key.

Create a local environment file:

```bash
cp .env.example .env.local
```

Set `ASSEMBLYAI_API_KEY` in `.env.local`, then restart the server. Without the key, the endpoint returns a safe unavailable response and the guided replay remains fully functional.

The integration uses:

- `GET https://streaming.assemblyai.com/v3/token`
- `wss://streaming.assemblyai.com/v3/ws`
- 16 kHz mono PCM16 chunks
- `speech_model=whisper-rt` for Vietnamese support
- an explicit `Terminate` event when a streaming session ends

## Local development

```bash
npm install
npm run dev
```

Quality checks:

```bash
npm run lint
npm run build
```

## Product safeguards

- The interface labels the scenario as a fictional exercise.
- AI-extracted changes require operator approval.
- Unverified public reports never become route closures automatically.
- Spoken routing answers use verified facts only.
- The initial report remains visible after the field update, preserving revision history.
- Live API credentials remain server-side.
