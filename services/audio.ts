
export async function mergeAudioUrls(urls: string[]): Promise<Blob> {
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  // Fetch and decode all buffers
  const buffers = await Promise.all(
    urls.map(async (url) => {
      const resp = await fetch(url);
      const arrayBuf = await resp.arrayBuffer();
      return await audioCtx.decodeAudioData(arrayBuf);
    })
  );

  if (buffers.length === 0) throw new Error("No audio to merge");

  // Calculate total length
  const totalLength = buffers.reduce((acc, buf) => acc + buf.length, 0);
  const outBuffer = audioCtx.createBuffer(
    buffers[0].numberOfChannels,
    totalLength,
    buffers[0].sampleRate
  );

  // Copy data
  let offset = 0;
  for (const buffer of buffers) {
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      outBuffer.getChannelData(channel).set(buffer.getChannelData(channel), offset);
    }
    offset += buffer.length;
  }

  return bufferToWav(outBuffer);
}

function bufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArray = new ArrayBuffer(length);
  const view = new DataView(bufferArray);
  let pos = 0;

  const setUint16 = (data: number) => { view.setUint16(pos, data, true); pos += 2; };
  const setUint32 = (data: number) => { view.setUint32(pos, data, true); pos += 4; };
  const writeString = (s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(pos++, s.charCodeAt(i)); };

  writeString('RIFF');
  setUint32(length - 8);
  writeString('WAVE');
  writeString('fmt ');
  setUint32(16);
  setUint16(1);
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan);
  setUint16(numOfChan * 2);
  setUint16(16);
  writeString('data');
  setUint32(length - pos - 4);

  for (let offset = 0; offset < buffer.length; offset++) {
    for (let i = 0; i < numOfChan; i++) {
      let sample = Math.max(-1, Math.min(1, buffer.getChannelData(i)[offset]));
      sample = (sample < 0 ? sample * 0x8000 : sample * 0x7FFF);
      view.setInt16(pos, sample, true);
      pos += 2;
    }
  }
  return new Blob([bufferArray], { type: 'audio/wav' });
}
