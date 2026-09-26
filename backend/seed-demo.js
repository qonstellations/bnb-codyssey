// Seeds one published demo experiment with fake participants so the results
// dashboard has something to show on demo day. Idempotent: re-running replaces
// the seeded sessions instead of piling up duplicates.
//
//   cd backend && npm run seed
//
// Env: MONGODB_URI (required), SEED_EMAIL / SEED_PASSWORD (default demo account).
import 'dotenv/config';
import crypto from 'crypto';
import mongoose from 'mongoose';
import Experiment from './src/models/Experiment.js';
import Session from './src/models/Session.js';
import Trial from './src/models/Trial.js';
import User from './src/models/User.js';

const EMAIL = (process.env.SEED_EMAIL || 'demo@codyssey.local').toLowerCase();
const PASSWORD = process.env.SEED_PASSWORD || 'demo1234';
const TITLE = 'Demo: Stroop Task';
const CODE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const code = () => [...crypto.randomBytes(8)].map((b) => CODE[b % 62]).join('');

// Deterministic-ish spread of RTs so charts look like data, not noise.
const CONGRUENT_RT = [412, 435, 468, 502, 545];
const INCONGRUENT_RT = [601, 634, 688, 712, 758];
const DEVICES = [
  { browser: 'Chrome 141', os: 'macOS 16.2', screenW: 2560, screenH: 1440, pixelRatio: 2 },
  { browser: 'Safari 26', os: 'iOS 26', screenW: 1179, screenH: 2556, pixelRatio: 3 },
  { browser: 'Firefox 145', os: 'Windows 11', screenW: 1920, screenH: 1080, pixelRatio: 1 },
];

function draft() {
  const trial = (id, content, correctKey, condition) => ({
    id,
    stimulus: { type: 'text', content, url: null },
    duration: 2000,
    fixationDuration: 500,
    validKeys: ['f', 'j'],
    correctKey,
    condition,
    feedback: { correct: 'Correct!', incorrect: 'Try again' },
  });
  return {
    settings: {
      consentText:
        'You are taking part in a short attention study. Your responses are anonymous — no name or email is collected. You may stop at any time.',
      instructionsText:
        'Press F if the WORD matches its ink colour, J if it does not. Respond as fast as you can without making errors.',
      fullscreen: false,
      showProgressBar: true,
      backgroundColor: '#808080',
      textColor: '#ffffff',
      fontSize: 48,
    },
    blocks: [
      {
        id: 'block_main',
        label: 'Main',
        shuffle: true,
        maxRepeats: 2,
        repetitions: 1,
        trials: [
          trial('t1', 'RED', 'f', 'congruent'),
          trial('t2', 'BLUE', 'j', 'incongruent'),
          trial('t3', 'GREEN', 'f', 'congruent'),
          trial('t4', 'YELLOW', 'j', 'incongruent'),
        ],
      },
    ],
    branches: [],
    loops: [],
  };
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set — copy .env.example to .env first.');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);

  let user = await User.findOne({ email: EMAIL });
  if (!user) {
    user = await User.create({ name: 'Demo Researcher', email: EMAIL, password: PASSWORD });
    console.log(`Created user ${EMAIL} (${PASSWORD})`);
  } else {
    console.log(`Using existing user ${EMAIL}`);
  }

  let experiment = await Experiment.findOne({ owner: user._id, title: TITLE });
  if (!experiment) {
    experiment = await Experiment.create({ owner: user._id, title: TITLE, draft: draft() });
  } else {
    experiment.draft = draft();
  }

  const snapshot = JSON.parse(JSON.stringify(experiment.draft));
  if (!experiment.slug) experiment.slug = code();
  experiment.status = 'active';
  experiment.versions = [
    ...experiment.versions.filter((v) => v.version !== 1),
    { version: 1, snapshot, publishedAt: new Date() },
  ];
  experiment.markModified('versions');
  await experiment.save();

  // Replace any previously seeded sessions so re-runs stay stable.
  const old = await Session.find({ experimentId: experiment._id }).select('_id');
  await Trial.deleteMany({ sessionId: { $in: old.map((s) => s._id) } });
  await Session.deleteMany({ experimentId: experiment._id });

  let total = 0;
  for (let i = 0; i < 12; i++) {
    const completed = i !== 9 && i !== 11; // 2 abandoned, for a realistic completion rate
    const excluded = i === 4;
    const device = DEVICES[i % DEVICES.length];
    const session = await Session.create({
      experimentId: experiment._id,
      participantId: crypto.randomUUID(),
      deviceInfo: device,
      calibration: {
        refreshRate: [60, 120][i % 2],
        jitter: Number((0.6 + (i % 5) * 0.4).toFixed(2)),
        score: [96, 91, 88, 74, 97, 84, 93, 69, 95, 90, 87, 92][i],
      },
      status: completed ? 'completed' : 'abandoned',
      excluded,
      withdrawCode: code(),
      startedAt: new Date(Date.now() - (12 - i) * 3600 * 1000),
      completedAt: completed ? new Date(Date.now() - (12 - i) * 3600 * 1000 + 700000) : null,
    });

    const trials = snapshot.blocks[0].trials.map((t, idx) => {
      const base = t.condition === 'congruent' ? CONGRUENT_RT : INCONGRUENT_RT;
      const rt = base[(i + idx) % base.length] + ((i * 7 + idx * 13) % 40) - 20;
      const wrong = (i + idx) % 7 === 3;
      const dropped = (i + idx) % 6 === 0 ? 2 : 0;
      return {
        sessionId: session._id,
        trialIndex: idx,
        blockId: 'block_main',
        condition: t.condition,
        stimulus: t.stimulus,
        response: wrong ? (t.correctKey === 'f' ? 'j' : 'f') : t.correctKey,
        correct: !wrong,
        rt: Number(rt.toFixed(1)),
        frameData: { intended: 120, actual: 120 - dropped, dropped },
      };
    });
    await Trial.insertMany(trials);
    total += trials.length;
  }

  console.log(`Seeded "${TITLE}" → /run/${experiment.slug}`);
  console.log(`  ${total} trials across 12 sessions (10 completed, 2 abandoned, 1 excluded)`);
  console.log(`  sign in as ${EMAIL} / ${PASSWORD}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
