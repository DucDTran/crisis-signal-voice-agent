class FloodSignalPCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.inputBuffer = [];
    this.inputSamplesPerChunk = Math.max(1, Math.round(sampleRate * 0.1));
    this.outputSamplesPerChunk = 1600;
  }

  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;

    for (let index = 0; index < input.length; index += 1) {
      this.inputBuffer.push(input[index]);
    }

    while (this.inputBuffer.length >= this.inputSamplesPerChunk) {
      const source = this.inputBuffer.splice(0, this.inputSamplesPerChunk);
      const pcm16 = new Int16Array(this.outputSamplesPerChunk);

      for (let index = 0; index < this.outputSamplesPerChunk; index += 1) {
        const sourceIndex = Math.min(
          source.length - 1,
          Math.floor((index / this.outputSamplesPerChunk) * source.length),
        );
        const value = Math.max(-1, Math.min(1, source[sourceIndex]));
        pcm16[index] = value < 0 ? value * 32768 : value * 32767;
      }

      this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
    }

    return true;
  }
}

registerProcessor('flood-signal-pcm', FloodSignalPCMProcessor);
