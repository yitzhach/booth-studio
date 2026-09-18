import test from "node:test";
import assert from "node:assert/strict";
import { muxMp4, sampleDuration, evenSize, vp9Level, MP4_TIMESCALE, CODECS, H264_CODECS, SIZES, videoSupported } from "../src/video.js";

// A muxer is either exactly right or it produces a file no player will open,
// and there is no middle ground to eyeball. So the file is parsed back here:
// the box tree is walked, every box's children are required to fill it
// exactly, and the sample tables are checked against the samples that went in.
// This is the only feedback available without a player — there is no ffprobe in
// the sandbox — and it is the feedback that matters, because a wrong box size
// is precisely what makes a file unopenable.

const CONTAINERS = new Set(["moov", "trak", "mdia", "minf", "stbl", "dinf"]);

function parse(bytes, start = 0, end = bytes.length) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const boxes = [];
  let at = start;
  while (at < end) {
    const size = view.getUint32(at);
    const type = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
    assert.ok(size >= 8, `${type} claims an impossible size of ${size}`);
    assert.ok(at + size <= end, `${type} at ${at} overruns its parent by ${at + size - end} bytes`);
    boxes.push({
      type,
      size,
      start: at,
      body: bytes.subarray(at + 8, at + size),
      children: CONTAINERS.has(type) ? parse(bytes, at + 8, at + size) : [],
    });
    at += size;
  }
  assert.equal(at, end, "boxes do not fill their parent exactly");
  return boxes;
}
const find = (boxes, path) =>
  path.split("/").reduce((level, type) => {
    const hit = (level.children || level).find?.((b) => b.type === type) ?? (Array.isArray(level) ? level.find((b) => b.type === type) : undefined);
    assert.ok(hit, `missing box ${type} (looking for ${path})`);
    return hit;
  }, boxes);

const DESCRIPTION = new Uint8Array([1, 0x64, 0, 0x28, 0xff, 0xe1, 0, 5, 0x67, 0x64, 0, 0x28, 1, 1, 0, 4, 0x68, 0xee, 0x3c, 0xb0]);
const sample = (byte, length, key) => ({
  data: Uint8Array.from({ length }, (_, i) => (i < 4 ? [0, 0, 0, length - 4][i] : byte)),
  duration: sampleDuration(30),
  key,
});
const clip = (count, everyKey = false) =>
  Array.from({ length: count }, (_, i) => sample(i + 1, 12 + i, everyKey || i === 0));

test("the file opens with ftyp and carries exactly ftyp, mdat and moov", () => {
  const file = muxMp4({ width: 1920, height: 1080, samples: clip(4), description: DESCRIPTION });
  const top = parse(file);
  assert.deepEqual(top.map((b) => b.type), ["ftyp", "mdat", "moov"]);
  assert.equal(String.fromCharCode(...top[0].body.subarray(0, 4)), "isom");
  // avc1 has to be in the compatible brands or players may not try H.264.
  const brands = [];
  for (let i = 8; i + 4 <= top[0].body.length; i += 4)
    brands.push(String.fromCharCode(...top[0].body.subarray(i, i + 4)));
  assert.ok(brands.includes("avc1"), `avc1 missing from brands ${brands}`);
});

test("the box tree holds every box a player walks to find the video", () => {
  const file = muxMp4({ width: 1280, height: 720, samples: clip(6), description: DESCRIPTION });
  const moov = find(parse(file), "moov");
  find(moov, "mvhd");
  const stbl = find(find(find(find(moov, "trak"), "mdia"), "minf"), "stbl");
  for (const type of ["stsd", "stts", "stsc", "stsz", "stco"]) find(stbl, type);
  find(find(find(moov, "trak"), "mdia"), "hdlr");
  find(find(find(find(moov, "trak"), "mdia"), "minf"), "dinf");
});

test("the sample description carries avc1 with the encoder's own avcC", () => {
  const file = muxMp4({ width: 1920, height: 1080, samples: clip(3), description: DESCRIPTION });
  const stbl = find(find(find(find(find(parse(file), "moov"), "trak"), "mdia"), "minf"), "stbl");
  // stsd is not walked as a container above, because its children sit behind a
  // version, flags and an entry count rather than at its start.
  const stsd = stbl.children.find((b) => b.type === "stsd");
  assert.ok(stsd, "stsd is present");
  assert.equal(new DataView(stsd.body.buffer, stsd.body.byteOffset).getUint32(4), 1, "one sample description");

  const avc1 = parse(stsd.body.subarray(8))[0];
  assert.equal(avc1.type, "avc1");
  const dv = new DataView(avc1.body.buffer, avc1.body.byteOffset);
  assert.equal(dv.getUint16(24), 1920, "avc1 records the frame width");
  assert.equal(dv.getUint16(26), 1080, "avc1 records the frame height");
  assert.equal(dv.getUint16(74), 0x18, "24-bit colour depth");

  // The avc1 sample entry is 78 bytes before its own child boxes begin.
  const avcC = parse(avc1.body.subarray(78))[0];
  assert.equal(avcC.type, "avcC");
  assert.deepEqual([...avcC.body], [...DESCRIPTION], "avcC is the encoder's description verbatim");
});

// VP9 in MP4, for the machines that ship without an H.264 encoder. The box
// below was three bytes short on the first attempt — the colour description is
// not optional — which mp4box.js caught and a player might not have. The exact
// length is therefore pinned.
test("a VP9 clip carries a vp09 entry and a complete vpcC record", () => {
  const file = muxMp4({ width: 1280, height: 720, samples: clip(4), kind: "vp09" });
  const stbl = find(find(find(find(find(parse(file), "moov"), "trak"), "mdia"), "minf"), "stbl");
  const stsd = stbl.children.find((b) => b.type === "stsd");
  const entry = parse(stsd.body.subarray(8))[0];
  assert.equal(entry.type, "vp09", "the sample entry names VP9");
  const vpcC = parse(entry.body.subarray(78))[0];
  assert.equal(vpcC.type, "vpcC");
  // version and flags (4) + profile + level + packed depth/chroma/range (3)
  // + colour primaries, transfer, matrix (3) + initialisation size (2).
  assert.equal(vpcC.body.length, 12, "vpcC must be a complete VP codec configuration record");
  assert.equal(vpcC.body[0], 1, "vpcC is version 1");
  assert.equal(vpcC.body[4], 0, "profile 0, which is 8-bit 4:2:0");
  assert.equal(vpcC.body[5], 31, "level 3.1 at 720p");
  assert.equal(vpcC.body[6] >> 4, 8, "8 bits per component");
  assert.deepEqual([...vpcC.body.subarray(7, 10)], [1, 1, 1], "BT.709 primaries, transfer and matrix");
  assert.equal(new DataView(vpcC.body.buffer, vpcC.body.byteOffset).getUint16(10), 0, "no initialisation data");
});

test("VP9 needs no description from the encoder, unlike H.264", () => {
  assert.doesNotThrow(() => muxMp4({ width: 640, height: 480, samples: clip(2), kind: "vp09" }));
  assert.throws(() => muxMp4({ width: 640, height: 480, samples: clip(2), kind: "avc" }), /did not describe/);
});

test("the VP9 level follows the frame size rather than being assumed", () => {
  assert.equal(vp9Level(1280, 720), 31);
  assert.equal(vp9Level(1920, 1080), 40);
  assert.equal(vp9Level(2560, 1440), 50);
  assert.equal(vp9Level(3840, 2160), 51);
  assert.equal(vp9Level(0, 0), 31, "a degenerate size still names a level");
});

test("the file's brands advertise the codec that is actually inside it", () => {
  const brandsOf = (file) => {
    const ftyp = parse(file)[0].body;
    const out = [];
    for (let i = 8; i + 4 <= ftyp.length; i += 4) out.push(String.fromCharCode(...ftyp.subarray(i, i + 4)));
    return out;
  };
  assert.ok(brandsOf(muxMp4({ width: 640, height: 480, samples: clip(2), description: DESCRIPTION })).includes("avc1"));
  const vp9 = brandsOf(muxMp4({ width: 640, height: 480, samples: clip(2), kind: "vp09" }));
  assert.ok(!vp9.includes("avc1"), "a VP9 file must not claim to be H.264");
  assert.ok(vp9.includes("iso6"), `VP9 brands were ${vp9}`);
});

test("the sample tables describe the samples that went in", () => {
  const samples = clip(5);
  const file = muxMp4({ width: 640, height: 480, samples, description: DESCRIPTION });
  const stbl = find(find(find(find(find(parse(file), "moov"), "trak"), "mdia"), "minf"), "stbl");
  const read = (type) => {
    const b = stbl.children.find((x) => x.type === type);
    assert.ok(b, `missing ${type}`);
    const dv = new DataView(b.body.buffer, b.body.byteOffset, b.body.byteLength);
    return { dv, body: b.body };
  };
  // stsz: sample_size 0 means per-sample sizes follow.
  const stsz = read("stsz");
  assert.equal(stsz.dv.getUint32(4), 0, "a variable sample size table");
  assert.equal(stsz.dv.getUint32(8), samples.length);
  for (let i = 0; i < samples.length; i++)
    assert.equal(stsz.dv.getUint32(12 + i * 4), samples[i].data.length, `size of sample ${i}`);
  // stts: identical durations coalesce into one run.
  const stts = read("stts");
  assert.equal(stts.dv.getUint32(4), 1, "one time-to-sample run");
  assert.equal(stts.dv.getUint32(8), samples.length);
  assert.equal(stts.dv.getUint32(12), sampleDuration(30));
  // stsc: one chunk holding every sample.
  const stsc = read("stsc");
  assert.equal(stsc.dv.getUint32(4), 1);
  assert.equal(stsc.dv.getUint32(12), samples.length, "all samples in one chunk");
});

// The offset table is the one number that cannot be checked by eye and breaks
// the file completely when wrong: a player seeks there and reads garbage.
test("the chunk offset points at the first sample's real bytes", () => {
  const samples = clip(4);
  const file = muxMp4({ width: 640, height: 480, samples, description: DESCRIPTION });
  const top = parse(file);
  const stbl = find(find(find(find(find(top, "moov"), "trak"), "mdia"), "minf"), "stbl");
  const stco = stbl.children.find((b) => b.type === "stco").body;
  const offset = new DataView(stco.buffer, stco.byteOffset).getUint32(8);
  const mdat = top.find((b) => b.type === "mdat");
  assert.equal(offset, mdat.start + 8, "the chunk starts just past the mdat header");
  assert.deepEqual([...file.subarray(offset, offset + samples[0].data.length)], [...samples[0].data]);
  // And the payload is every sample, in order, with nothing between them.
  const expected = samples.flatMap((s) => [...s.data]);
  assert.deepEqual([...file.subarray(offset, offset + expected.length)], expected);
  assert.equal(mdat.size, expected.length + 8, "mdat is sized to its payload");
});

test("stss is written only when some frames are not keyframes", () => {
  const stblOf = (samples) =>
    find(find(find(find(find(parse(muxMp4({ width: 640, height: 480, samples, description: DESCRIPTION })), "moov"), "trak"), "mdia"), "minf"), "stbl");
  const every = stblOf(clip(4, true));
  assert.equal(every.children.find((b) => b.type === "stss"), undefined, "an all-keyframe clip needs no sync table");
  const some = stblOf(clip(4));
  const stss = some.children.find((b) => b.type === "stss");
  assert.ok(stss, "a clip with delta frames lists its keyframes");
  const dv = new DataView(stss.body.buffer, stss.body.byteOffset);
  assert.equal(dv.getUint32(4), 1, "one keyframe");
  assert.equal(dv.getUint32(8), 1, "sync sample numbers are 1-based");
});

test("the durations agree between the movie, the track and the media", () => {
  const samples = clip(90);
  const file = muxMp4({ width: 1920, height: 1080, samples, description: DESCRIPTION });
  const total = samples.length * sampleDuration(30);
  const moov = find(parse(file), "moov");
  const at = (box, offset) => new DataView(box.body.buffer, box.body.byteOffset).getUint32(offset);
  const mvhd = moov.children.find((b) => b.type === "mvhd");
  assert.equal(at(mvhd, 12), MP4_TIMESCALE, "movie timescale");
  assert.equal(at(mvhd, 16), total, "movie duration");
  const trak = moov.children.find((b) => b.type === "trak");
  const tkhd = trak.children.find((b) => b.type === "tkhd");
  assert.equal(at(tkhd, 20), total, "track duration");
  const mdhd = trak.children.find((b) => b.type === "mdia").children.find((b) => b.type === "mdhd");
  assert.equal(at(mdhd, 12), MP4_TIMESCALE, "media timescale");
  assert.equal(at(mdhd, 16), total, "media duration");
  // 3 seconds at 30fps, stated in seconds so the arithmetic is legible.
  assert.equal(total / MP4_TIMESCALE, 3);
});

test("a frame rate that does not divide the timescale still round-trips", () => {
  for (const fps of [24, 25, 30, 50, 60])
    assert.equal(sampleDuration(fps) * fps, MP4_TIMESCALE, `${fps}fps is exact`);
});

test("the muxer refuses what it cannot write rather than writing a broken file", () => {
  assert.throws(() => muxMp4({ width: 640, height: 480, samples: [], description: DESCRIPTION }), /Nothing was recorded/);
  assert.throws(() => muxMp4({ width: 640, height: 480, samples: clip(2) }), /did not describe/);
});

test("H.264 needs even dimensions, and every offered size already has them", () => {
  assert.equal(evenSize(1081), 1082);
  assert.equal(evenSize(1080), 1080);
  assert.equal(evenSize(0), 2, "a collapsed viewport still produces a legal frame");
  for (const [key, size] of Object.entries(SIZES)) {
    assert.equal(evenSize(size.width), size.width, `${key} width`);
    assert.equal(evenSize(size.height), size.height, `${key} height`);
  }
});

test("codecs are offered best first, with VP9 only as the last resort", () => {
  assert.equal(H264_CODECS[0], "avc1.640028", "High profile is tried first");
  assert.ok(H264_CODECS.at(-1).startsWith("avc1.42"), "then Baseline, which everything decodes");
  // H.264 is what every player and upload form takes, so VP9 must never be
  // chosen on a machine that could have encoded H.264.
  const kinds = CODECS.map((c) => c.kind);
  assert.equal(kinds.lastIndexOf("avc") < kinds.indexOf("vp09"), true, "every H.264 option is tried before VP9");
  assert.equal(kinds.filter((k) => k === "vp09").length, 1);
  assert.equal(CODECS.at(-1).codec.startsWith("vp09."), true);
});

test("support detection does not throw where WebCodecs is absent", () => {
  assert.equal(videoSupported(), typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined");
});
