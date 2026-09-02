# FloodSignal

FloodSignal is a voice-to-map flood operations simulation localized to Vinh City, Vietnam. It turns live public calls and field radio updates into a shared operational picture as the transcript and AI incident memory update in real time.

Every flood condition, measurement, closure, timestamp, and response in this project is fictional. Real Vinh landmarks are used only to make the hackathon demonstration easy to understand.

## Demo flow

1. Select **Run live simulation** to start an English public call about possible flooding near the northern approach to Ben Thuy Bridge 1.
2. Watch the transcript appear word by word while the AI incident memory extracts the location, hazard, and trend.
3. The simulated Road Team 3 radio transmission follows automatically and adds the measured depth, route status, and barrier status.
4. The map updates automatically from possible flooding to a simulated 35 cm flood extent with the northern approach marked impassable.
5. The command briefing appears when the stream completes, keeping the full evidence trail visible beside it.
6. Use **Reset exercise** to repeat the demonstration.

The replay controls use browser speech synthesis for deterministic English audio. This makes the guided demo work without external credentials.

## Real Vinh landmarks

- Ben Thuy Bridge 1
- Vinh Railway Station
- Vinh Market
- Vinh University

The map uses OpenStreetMap raster tiles. Landmark coordinates were resolved through OpenStreetMap Nominatim.

## AssemblyAI live English transcription

The optional microphone mode uses AssemblyAI Universal-3 Pro Streaming with `speech_model=u3-rt-pro`. The server mints a short-lived single-use token so the browser never receives the API key.

Create a local environment file:

```bash
cp .env.example .env.local
```

Set `ASSEMBLYAI_API_KEY` in `.env.local`, then restart the server. Without the key, the endpoint returns a safe unavailable response and the guided replay remains fully functional.

The integration uses:

- `GET https://streaming.assemblyai.com/v3/token`
- `wss://streaming.assemblyai.com/v3/ws`
- 16 kHz mono PCM16 chunks
- `speech_model=u3-rt-pro` with an emergency-operations prompt
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
- Public reports create a clearly qualified possible-flood state.
- The automatic route closure appears only after the simulated field team reports a measured depth and an impassable route.
- Every summary field remains traceable to its source transcript.
- The initial report remains visible after the field update, preserving revision history.
- Live API credentials remain server-side.
