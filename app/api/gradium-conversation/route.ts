import {
  addSilence,
  gradiumVoiceFor,
  pcm16ToWav,
  synthesizeGradiumPcm,
  type GradiumSpeaker,
} from '@/lib/gradium';

type ConversationTurn = {
  speaker?: unknown;
  text?: unknown;
};

type ConversationBody = {
  turns?: unknown;
};

function isSpeaker(value: unknown): value is GradiumSpeaker {
  return value === 'reporter' || value === 'operator' || value === 'field';
}

export async function POST(request: Request) {
  let body: ConversationBody;
  try {
    body = (await request.json()) as ConversationBody;
  } catch {
    return Response.json({ error: 'Invalid conversation request.' }, { status: 400 });
  }

  if (!Array.isArray(body.turns) || body.turns.length < 1 || body.turns.length > 12) {
    return Response.json({ error: 'A conversation must contain 1 to 12 turns.' }, { status: 400 });
  }

  const turns = body.turns.map((turn) => {
    const item = (turn ?? {}) as ConversationTurn;
    return {
      speaker: isSpeaker(item.speaker) ? item.speaker : 'reporter',
      text: typeof item.text === 'string' ? item.text.trim() : '',
    };
  });

  if (turns.some((turn) => !turn.text || turn.text.length > 1_200)) {
    return Response.json(
      { error: 'Every conversation turn must contain 1 to 1,200 characters.' },
      { status: 400 },
    );
  }

  try {
    const clips: Uint8Array[] = [];
    for (const turn of turns) {
      clips.push(
        await synthesizeGradiumPcm(
          turn.text,
          gradiumVoiceFor(turn.speaker),
        ),
      );
    }
    let audio = new Uint8Array();
    for (const [index, pcm] of clips.entries()) {
      const combined = new Uint8Array(audio.length + pcm.length);
      combined.set(audio);
      combined.set(pcm, audio.length);
      audio = combined;
      if (index < turns.length - 1) {
        audio = addSilence(
          audio,
          turns[index]?.speaker === 'operator' ? 420 : 560,
        );
      }
    }

    return new Response(pcm16ToWav(audio), {
      headers: {
        'content-type': 'audio/wav',
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Conversation synthesis failed.';
    return Response.json({ error: message }, { status: 502 });
  }
}
