# Vinh City call fixtures

The `vinh/generated` directory contains complete English synthetic emergency conversations for the local CrisisSignal demonstration. They are generated in advance with Gradium, with separate reporter/field and operator voices and natural pauses. During the demo, the prepared 16 kHz WAV is streamed through the AssemblyAI Universal-3 Pro WebSocket before finalized turns are sent to the AssemblyAI LLM Gateway.

Run `npm run generate:gradium-audio` after changing a scenario dialogue or voice ID. The generator permits at most two active Gradium sessions and reuses existing files unless called with `-- --force`.

They do not represent real incidents, people, or emergency recordings.
