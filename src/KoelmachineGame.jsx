import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Calculator, Zap, Snowflake, Flame, Gauge, ArrowRight, CheckCircle, X, Check, ChevronRight, RotateCcw, Trophy, Heart, Info, Eraser, Target, Thermometer, Lightbulb, Wind, Wrench } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// SCREENS
// ═══════════════════════════════════════════════════════════════

const SCREENS = [
  'start', 'm1_intro',
  'm1r1', 'm1r1_check',
  'm1r2', 'm1r2_check',
  'm2_intro',
  'm2r1', 'm2r1_check',
  'm2r2', 'm2r2_check',
  'm2r3', 'm2r3_check',
  'end'
];

// ═══════════════════════════════════════════════════════════════
// R-134a SATURATION TABLE
// ═══════════════════════════════════════════════════════════════

const SAT_TABLE = [
  { T: -40, P: 0.51, hL: 148, hV: 373 },
  { T: -30, P: 0.85, hL: 161, hV: 380 },
  { T: -26, P: 1.00, hL: 166, hV: 383 },
  { T: -20, P: 1.33, hL: 174, hV: 386 },
  { T: -10, P: 2.01, hL: 187, hV: 392 },
  { T: -4,  P: 2.50, hL: 193, hV: 395 },
  { T:  0,  P: 2.93, hL: 200, hV: 398 },
  { T:  1,  P: 3.00, hL: 201, hV: 398 },
  { T: 10,  P: 4.15, hL: 213, hV: 404 },
  { T: 20,  P: 5.72, hL: 227, hV: 409 },
  { T: 30,  P: 7.70, hL: 241, hV: 414 },
  { T: 32,  P: 8.00, hL: 243, hV: 415 },
  { T: 36,  P: 9.00, hL: 249, hV: 416 },
  { T: 40,  P: 10.16, hL: 256, hV: 418 },
  { T: 50,  P: 13.18, hL: 271, hV: 421 },
  { T: 60,  P: 16.81, hL: 287, hV: 424 },
  { T: 70,  P: 21.16, hL: 303, hV: 425 },
  { T: 80,  P: 26.33, hL: 320, hV: 425 },
  { T: 90,  P: 32.44, hL: 339, hV: 423 },
  { T: 100, P: 39.72, hL: 358, hV: 418 },
];

const CRITICAL_POINT = { h: 373, P: 40.59, T: 101 };

function lerp(a, b, t) { return a + (b - a) * t; }

function satAtP(P) {
  if (P <= SAT_TABLE[0].P) return SAT_TABLE[0];
  if (P >= SAT_TABLE[SAT_TABLE.length - 1].P) return SAT_TABLE[SAT_TABLE.length - 1];
  for (let i = 0; i < SAT_TABLE.length - 1; i++) {
    const a = SAT_TABLE[i], b = SAT_TABLE[i + 1];
    if (P >= a.P && P <= b.P) {
      const t = (Math.log(P) - Math.log(a.P)) / (Math.log(b.P) - Math.log(a.P));
      return { T: lerp(a.T, b.T, t), P, hL: lerp(a.hL, b.hL, t), hV: lerp(a.hV, b.hV, t) };
    }
  }
  return SAT_TABLE[SAT_TABLE.length - 1];
}

function satAtT(T) {
  if (T <= SAT_TABLE[0].T) return SAT_TABLE[0];
  if (T >= SAT_TABLE[SAT_TABLE.length - 1].T) return SAT_TABLE[SAT_TABLE.length - 1];
  for (let i = 0; i < SAT_TABLE.length - 1; i++) {
    const a = SAT_TABLE[i], b = SAT_TABLE[i + 1];
    if (T >= a.T && T <= b.T) {
      const t = (T - a.T) / (b.T - a.T);
      return { T, P: Math.exp(lerp(Math.log(a.P), Math.log(b.P), t)), hL: lerp(a.hL, b.hL, t), hV: lerp(a.hV, b.hV, t) };
    }
  }
  return SAT_TABLE[SAT_TABLE.length - 1];
}

function lookupTemp(h, P) {
  const sat = satAtP(P);
  if (h < sat.hL - 1) {
    if (h <= SAT_TABLE[0].hL) return SAT_TABLE[0].T;
    for (let i = 0; i < SAT_TABLE.length - 1; i++) {
      if (h >= SAT_TABLE[i].hL && h <= SAT_TABLE[i + 1].hL) {
        const t = (h - SAT_TABLE[i].hL) / (SAT_TABLE[i + 1].hL - SAT_TABLE[i].hL);
        return lerp(SAT_TABLE[i].T, SAT_TABLE[i + 1].T, t);
      }
    }
    return SAT_TABLE[SAT_TABLE.length - 1].T;
  }
  if (h > sat.hV + 1) return sat.T + (h - sat.hV) / 0.9;
  return sat.T;
}

// ═══════════════════════════════════════════════════════════════
// DIAGRAM GEOMETRIE
// ═══════════════════════════════════════════════════════════════

const SVG_W = 900, SVG_H = 560;
const PLOT = { left: 95, right: 870, top: 40, bottom: 500 };
const PLOT_W = PLOT.right - PLOT.left;
const PLOT_H = PLOT.bottom - PLOT.top;
const RANGE = { hMin: 140, hMax: 560, pMin: 0.5, pMax: 50 };

function enthalpyToX(h) { return PLOT.left + ((h - RANGE.hMin) / (RANGE.hMax - RANGE.hMin)) * PLOT_W; }
function xToEnthalpy(x) { return RANGE.hMin + ((x - PLOT.left) / PLOT_W) * (RANGE.hMax - RANGE.hMin); }
function pressureToY(P) {
  const logPMin = Math.log10(RANGE.pMin), logPMax = Math.log10(RANGE.pMax);
  return PLOT.bottom - ((Math.log10(P) - logPMin) / (logPMax - logPMin)) * PLOT_H;
}
function yToPressure(y) {
  const logPMin = Math.log10(RANGE.pMin), logPMax = Math.log10(RANGE.pMax);
  return Math.pow(10, logPMin + ((PLOT.bottom - y) / PLOT_H) * (logPMax - logPMin));
}
function hpToXY(h, P) { return [enthalpyToX(h), pressureToY(P)]; }

const P_GRID = [0.5, 1, 2, 5, 10, 20, 50];
const H_GRID = [140, 200, 260, 320, 380, 440, 500, 560];

const LIQUID_POINTS = SAT_TABLE.map(s => [s.hL, s.P]).concat([[CRITICAL_POINT.h, CRITICAL_POINT.P]]);
const VAPOR_POINTS = SAT_TABLE.map(s => [s.hV, s.P]).concat([[CRITICAL_POINT.h, CRITICAL_POINT.P]]);

function pointsToPath(pts) {
  return pts.map(([h, P], i) => {
    const [x, y] = hpToXY(h, P);
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
}

const LIQUID_PATH = pointsToPath(LIQUID_POINTS);
const VAPOR_PATH = pointsToPath(VAPOR_POINTS);
const DOME_PATH = (() => {
  const liqPx = LIQUID_POINTS.map(([h, P]) => hpToXY(h, P));
  const vapPx = [...VAPOR_POINTS].reverse().map(([h, P]) => hpToXY(h, P));
  return [...liqPx, ...vapPx].map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ') + ' Z';
})();

const ISOTHERM_TEMPS = [-20, 0, 20, 40, 60, 80];

function buildIsotherm(T) {
  // Superheated-tak MOET consistent zijn met computePoint() / lookupTemp() (cp = 0,9),
  // anders ligt de visuele T-curve niet waar de validatie hem verwacht.
  const sat = satAtT(T);
  const pts = [];
  if (sat.P < 50) { pts.push([sat.hL, 50]); pts.push([sat.hL, sat.P]); } else { pts.push([sat.hL, sat.P]); }
  pts.push([sat.hV, sat.P]);
  const steps = 20;
  for (let i = 1; i <= steps; i++) {
    const frac = i / steps;
    const p = sat.P * Math.pow(0.5 / sat.P, frac);
    if (p < 0.5) break;
    const satP = satAtP(p);
    const h = satP.hV + 0.9 * (T - satP.T);
    pts.push([h, p]);
  }
  return pts;
}

const ISOTHERM_PATHS = ISOTHERM_TEMPS.map(T => ({
  T,
  path: pointsToPath(buildIsotherm(T).filter(([h, P]) => h >= RANGE.hMin - 20 && h <= RANGE.hMax + 20 && P >= RANGE.pMin && P <= RANGE.pMax)),
  labelPos: (() => { const sat = satAtT(T); const [x, y] = hpToXY(sat.hL - 4, sat.P); return { x, y }; })(),
}));

// ═══════════════════════════════════════════════════════════════
// GAME DATA — MISSIE 1 (meten aan koelmachine)
// Waardes komen overeen met M2_MEASUREMENTS_R3
// ═══════════════════════════════════════════════════════════════

const M1_MEASUREMENTS = {
  lowPressureEff: 2.0,
  highPressureEff: 8.0,
  lowPressureAbs: 3.0,
  highPressureAbs: 9.0,
  T_verdamping: 1,
  T_condensatie: 36,
  T_eindcompressie: 60,
  T_voor_expansie: 25,
  T_zuigleiding: 15,
};

// Meetpunten in het schema
const MEASUREMENT_POINTS = [
  { id: 'hp', label: 'Hoge druk manometer', shortLabel: 'HP', value: '8,0 bar', valueNum: 8.0, unit: 'bar (eff)', color: '#991B1B', location: 'persleiding' },
  { id: 'lp', label: 'Lage druk manometer', shortLabel: 'LP', value: '2,0 bar', valueNum: 2.0, unit: 'bar (eff)', color: '#1E3A8A', location: 'zuigleiding' },
  { id: 't_verd', label: 'Verdampingstemperatuur', shortLabel: 'T_verd', value: '1 °C', valueNum: 1, unit: '°C', color: '#0891B2', location: 'verdamper' },
  { id: 't_cond', label: 'Condensatietemperatuur', shortLabel: 'T_cond', value: '36 °C', valueNum: 36, unit: '°C', color: '#DC2626', location: 'condensor' },
  { id: 't_comp', label: 'Eindcompressietemperatuur', shortLabel: 'T_comp', value: '60 °C', valueNum: 60, unit: '°C', color: '#EA580C', location: 'persleiding' },
  { id: 't_exp', label: 'T voor expansieventiel', shortLabel: 'T_exp', value: '25 °C', valueNum: 25, unit: '°C', color: '#7C3AED', location: 'vloeistofleiding' },
  { id: 't_zuig', label: 'Zuigleidingtemperatuur', shortLabel: 'T_zuig', value: '15 °C', valueNum: 15, unit: '°C', color: '#059669', location: 'zuigleiding' },
];

// ═══════════════════════════════════════════════════════════════
// GAME DATA — MISSIE 2 (meetwaardes en verwachte uitkomsten)
// ═══════════════════════════════════════════════════════════════

const M2_MEASUREMENTS_R12 = {
  lowPressureEff: 1.5, highPressureEff: 7.0,
  lowPressureAbs: 2.5, highPressureAbs: 8.0,
  T_verdamping: -4, T_condensatie: 32,
  T_eindcompressie: 55, T_voor_expansie: 21, T_zuigleiding: 4,
};

const M2_MEASUREMENTS_R3 = { ...M1_MEASUREMENTS };

function computePoint(T, P, region) {
  const sat = satAtP(P);
  // cp = 0.9 (ideaal-gas benadering voor R-134a-damp)
  // MOET consistent zijn met lookupTemp, anders leest de crosshair-T anders dan de beoogde T.
  if (region === 'superheated') return { h: sat.hV + 0.9 * (T - sat.T), P };
  if (region === 'subcooled') return { h: satAtT(T).hL, P };
  return { h: sat.hL + (sat.hV - sat.hL) * 0.5, P };
}

const M2_EXPECTED_R12 = {
  p1: computePoint(M2_MEASUREMENTS_R12.T_zuigleiding, M2_MEASUREMENTS_R12.lowPressureAbs, 'superheated'),
  p2: computePoint(M2_MEASUREMENTS_R12.T_eindcompressie, M2_MEASUREMENTS_R12.highPressureAbs, 'superheated'),
  p3: computePoint(M2_MEASUREMENTS_R12.T_voor_expansie, M2_MEASUREMENTS_R12.highPressureAbs, 'subcooled'),
  oververhitting: M2_MEASUREMENTS_R12.T_zuigleiding - M2_MEASUREMENTS_R12.T_verdamping,
  onderkoeling: M2_MEASUREMENTS_R12.T_condensatie - M2_MEASUREMENTS_R12.T_voor_expansie,
};

const M2_EXPECTED_R3 = {
  p1: computePoint(M2_MEASUREMENTS_R3.T_zuigleiding, M2_MEASUREMENTS_R3.lowPressureAbs, 'superheated'),
  p2: computePoint(M2_MEASUREMENTS_R3.T_eindcompressie, M2_MEASUREMENTS_R3.highPressureAbs, 'superheated'),
  p3: computePoint(M2_MEASUREMENTS_R3.T_voor_expansie, M2_MEASUREMENTS_R3.highPressureAbs, 'subcooled'),
  oververhitting: M2_MEASUREMENTS_R3.T_zuigleiding - M2_MEASUREMENTS_R3.T_verdamping,
  onderkoeling: M2_MEASUREMENTS_R3.T_condensatie - M2_MEASUREMENTS_R3.T_voor_expansie,
};

function deriveEfficiencies(expected) {
  const h1 = expected.p1.h, h2 = expected.p2.h, h3 = expected.p3.h, h4 = expected.p3.h;
  const dhVerd = h1 - h4, dhComp = h2 - h1, dhCond = h2 - h3;
  return {
    h1: Math.round(h1), h2: Math.round(h2), h3: Math.round(h3), h4: Math.round(h4),
    dhVerd: Math.round(dhVerd), dhComp: Math.round(dhComp), dhCond: Math.round(dhCond),
    eer: Math.round(dhVerd / dhComp * 10) / 10,
    cop: Math.round(dhCond / dhComp * 10) / 10,
  };
}

// ═══════════════════════════════════════════════════════════════
// ITEMBANKS
// ═══════════════════════════════════════════════════════════════

const ITEMBANKS = {
  m1r1_check: [
    { question: 'Waar lees je de hoge druk af op een koelinstallatie?',
      options: ['Op de manometer aan de persleiding (hogedrukzijde)', 'Op de manometer aan de zuigleiding', 'Op het display van de compressor', 'Op de thermometer bij de condensor'],
      correct: 0,
      feedbackCorrect: 'Juist! De hoge druk lees je af op de manometer aan de persleiding, de hogedrukzijde van de installatie.',
      feedbackWrong: 'De hoge druk lees je af op de manometer aan de persleiding (hogedrukzijde).' },
    { question: 'Waarom meet je de zuigleidingtemperatuur?',
      options: ['Om de oververhitting te kunnen berekenen', 'Om de condensatietemperatuur te controleren', 'Om het compressorvermogen te bepalen', 'Dat is niet nodig bij een koelinstallatie'],
      correct: 0,
      feedbackCorrect: 'Precies! Met de zuigleidingtemperatuur en de verdampingstemperatuur bereken je de oververhitting.',
      feedbackWrong: 'De zuigleidingtemperatuur heb je nodig om de oververhitting te berekenen (T_zuig − T_verdamping).' },
  ],
  m1r2_check: [
    { question: 'Je leest 8,0 bar af op de hogedrukmanometer. Wat is de absolute druk?',
      options: ['9,0 bar', '8,0 bar', '7,0 bar', '16,0 bar'],
      correct: 0,
      feedbackCorrect: 'Juist! 8,0 bar effectief + 1 bar atmosferisch = 9,0 bar absoluut.',
      feedbackWrong: 'Absolute druk = effectieve druk + 1 bar. Dus 8,0 + 1 = 9,0 bara.' },
    { question: 'Op welke twee plaatsen meet je de druk bij een koelinstallatie?',
      options: ['Aan de hogedrukzijde (persleiding) en de lagedrukzijde (zuigleiding)', 'Bij de condensor en het expansieventiel', 'Alleen bij de compressor', 'Bij de verdamper en de condensor'],
      correct: 0,
      feedbackCorrect: 'Klopt! Je meet de druk aan de hogedrukzijde (persleiding) en de lagedrukzijde (zuigleiding).',
      feedbackWrong: 'Bij een koelinstallatie meet je de druk op twee plaatsen: de hogedrukzijde (persleiding) en de lagedrukzijde (zuigleiding).' },
    { question: 'Wat vertelt de verdampingstemperatuur je?',
      options: ['Bij welke temperatuur het koudemiddel verdampt bij de gemeten lage druk', 'Hoe warm de ruimte is die gekoeld wordt', 'De temperatuur van het koelwater', 'Het rendement van de installatie'],
      correct: 0,
      feedbackCorrect: 'Goed! De verdampingstemperatuur is de temperatuur waarbij het koudemiddel verdampt bij de gemeten lage druk. Dit is een verzadigingstemperatuur.',
      feedbackWrong: 'De verdampingstemperatuur is de temperatuur waarbij het koudemiddel verdampt bij de gemeten lage druk — een verzadigingseigenschap.' },
  ],
  m2r1_check: [
    { question: 'Welke lijnen teken je als eerste in het h-log p diagram?',
      options: ['De druklijnen (hoge- en lagedruklijn)', 'De isothermen', 'De verbindingslijnen tussen de punten', 'De verzadigingslijnen'],
      correct: 0,
      feedbackCorrect: 'Juist! Je begint altijd met de hoge- en lagedruklijn. Daarna plaats je de punten.',
      feedbackWrong: 'Je begint met de druklijnen. Die geven de twee drukniveaus aan waarop het bootje getekend wordt.' },
    { question: 'Hoe lopen de isothermen in het vloeistofgebied van het h-log p diagram?',
      options: ['Verticaal', 'Horizontaal', 'Diagonaal omhoog', 'Gebogen als een boog'],
      correct: 0,
      feedbackCorrect: 'Klopt! In het vloeistofgebied lopen isothermen verticaal.',
      feedbackWrong: 'In het vloeistofgebied lopen isothermen verticaal (h hangt daar bijna alleen af van T).' },
    { question: 'Waar komen de drukken en temperaturen vandaan die je nodig hebt om het bootje te tekenen?',
      options: ['Die meet je op een draaiende koelinstallatie', 'Die bereken je uit het diagram zelf', 'Die staan altijd vast per koudemiddel', 'Die schat je in op basis van de buitentemperatuur'],
      correct: 0,
      feedbackCorrect: 'Klopt! Je meet de drukken en temperaturen op een draaiende installatie en tekent daarmee het bootje in het diagram.',
      feedbackWrong: 'De drukken en temperaturen meet je met manometers en thermometers op een draaiende koelinstallatie.' },
  ],
  m2r2_check: [
    { question: 'Waarom heeft punt 4 dezelfde enthalpie als punt 3?',
      options: ['Omdat het expansieventiel isenthalp is (geen energie toegevoegd of afgevoerd)', 'Omdat de temperatuur gelijk blijft', 'Omdat de druk gelijk blijft', 'Toeval, dat hoeft niet altijd'],
      correct: 0,
      feedbackCorrect: 'Juist! Het expansieventiel is isenthalp: er wordt geen energie toegevoegd of afgevoerd.',
      feedbackWrong: 'Het expansieventiel is isenthalp: de enthalpie blijft gelijk. Daarom h4 = h3.' },
    { question: 'Een koelinstallatie met R-134a heeft afgelezen enthalpieën: h1 = 395, h2 = 430, h3 = 245 kJ/kg. Wat is de EER?',
      options: ['4,3', '3,5', '5,0', '6,0'],
      correct: 0,
      feedbackCorrect: 'Klopt! EER = (395 − 245) / (430 − 395) = 150 / 35 ≈ 4,3.',
      feedbackWrong: 'EER = Δh_verd / Δh_comp = (h1 − h4) / (h2 − h1) = 150 / 35 ≈ 4,3.' },
    { question: 'Wat lees je op de x-as van het h-log p diagram af?',
      options: ['Enthalpie in kJ/kg', 'Druk in bar', 'Temperatuur in °C', 'Entropie in kJ/(kg·K)'],
      correct: 0,
      feedbackCorrect: 'Goed! Op de x-as staat de enthalpie in kJ/kg.',
      feedbackWrong: 'X-as = enthalpie (kJ/kg), Y-as = druk (bar, log-schaal).' },
  ],
  m2r3_check: [
    { question: 'Waarom is oververhitting belangrijk bij een koelinstallatie?',
      options: ['Het beschermt de compressor tegen vloeistofslag', 'Het verhoogt het rendement van de condensor', 'Het verlaagt de druk in het systeem', 'Het zorgt voor een koudere verdamper'],
      correct: 0,
      feedbackCorrect: 'Juist! Oververhitting zorgt ervoor dat er alleen gas de compressor in gaat — geen vloeistof. Dat voorkomt schade.',
      feedbackWrong: 'Oververhitting beschermt de compressor: als er vloeistof in de compressor komt, kan die kapotgaan (vloeistofslag).' },
    { question: 'Wat is het risico als er te weinig onderkoeling is?',
      options: ['Er ontstaat flashgas in de vloeistofleiding vóór het expansieventiel', 'De compressor slaat kapot', 'De verdamper bevriest', 'De druk wordt te hoog'],
      correct: 0,
      feedbackCorrect: 'Goed! Zonder voldoende onderkoeling kan er damp (flashgas) ontstaan in de vloeistofleiding, wat de capaciteit verlaagt.',
      feedbackWrong: 'Te weinig onderkoeling betekent dat het koudemiddel niet genoeg is afgekoeld. Dan ontstaat er flashgas vóór het expansieventiel.' },
    { question: 'Een installatie heeft een EER van 5,0 en een COP van 6,0. Wat klopt er?',
      options: ['COP is altijd EER + 1', 'COP is altijd lager dan EER', 'EER en COP zijn hetzelfde', 'COP is het dubbele van EER'],
      correct: 0,
      feedbackCorrect: 'Klopt! COP = EER + 1. De condensor voert alle warmte af: verdamperwarmte + compressorenergie.',
      feedbackWrong: 'COP = EER + 1, altijd. De condensor voert meer af dan de verdamper opneemt, want de compressor voegt ook energie toe.' },
  ],
};

// ═══════════════════════════════════════════════════════════════
// SCORING
// ═══════════════════════════════════════════════════════════════

const SCORING = {
  m1r1: { perStep: 2 },            // 7 × 2 = 14
  m1r1_check: { first: 4, second: 2 },  // 1 vraag
  m1r2: { perField: 1 },               // 9 × 1 = 9
  m1r2_check: { first: 4, second: 2 }, // 1 vraag
  m2r1: { perStep: 2 },                // 6 × 2 = 12
  m2r1_check: { first: 4, second: 2 }, // 1 vraag
  m2r2: { bootje: 8, perH: 1, final: 8 },
  m2r2_check: { first: 4, second: 2 }, // 1 vraag
  m2r3: { bootje: 8, ovh: 3, onk: 4 },
  m2r3_check: { first: 7, second: 3 }, // 1 vraag
};

// ═══════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function prepareAllQuestions(itembank) {
  // Pick 1 random question from the bank, shuffle its answers
  const q = itembank[Math.floor(Math.random() * itembank.length)];
  const items = q.options.map((opt, i) => ({ text: opt, isCorrect: i === q.correct }));
  const shuffled = shuffleArray(items);
  return [{
    question: q.question,
    options: shuffled.map(x => x.text),
    correct: shuffled.findIndex(x => x.isCorrect),
    feedbackCorrect: q.feedbackCorrect,
    feedbackWrong: q.feedbackWrong,
  }];
}

function getMissionAndRound(screen) {
  const idx = SCREENS.indexOf(screen);
  if (idx <= 0) return { mission: 0, round: 0, totalM1: 2, totalM2: 3 };
  if (idx <= 5) return { mission: 1, round: Math.ceil(idx / 2), totalM1: 2, totalM2: 3 };
  if (idx <= 12) return { mission: 2, round: Math.ceil((idx - 6) / 2), totalM1: 2, totalM2: 3 };
  return { mission: 2, round: 3, totalM1: 2, totalM2: 3 };
}

function fmtNum(n, decimals = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toFixed(decimals).replace('.', ',');
}
function parseNum(str) {
  if (typeof str !== 'string') return NaN;
  return parseFloat(str.replace(',', '.'));
}

// ═══════════════════════════════════════════════════════════════
// PROGRESS BAR
// ═══════════════════════════════════════════════════════════════

function ProgressBar({ screen, lives, score }) {
  const info = getMissionAndRound(screen);
  if (info.mission === 0) return null;
  const total = info.mission === 1 ? info.totalM1 : info.totalM2;
  return (
    <div className="flex items-center gap-3 px-4 py-2 text-sm" style={{ background: '#2C1810' }}>
      <span className="font-bold text-white">Missie {info.mission}</span>
      <span className="text-white/40">|</span>
      <div className="flex gap-1">
        {Array.from({ length: total }, (_, i) => i + 1).map(r => (
          <div key={r} className={`w-3 h-3 rounded-full border-2 border-white/60 ${r <= info.round ? 'bg-white' : 'bg-transparent'}`} />
        ))}
      </div>
      {screen.includes('_check') && <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded" style={{ background: '#FBBF24', color: '#2C1810' }}>Check</span>}
      <div className="ml-auto flex items-center gap-3">
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map(h => (
            <Heart key={h} className="w-4 h-4 transition-all duration-300"
              fill={h <= lives ? '#E74C3C' : 'transparent'}
              stroke={h <= lives ? '#E74C3C' : '#8B7355'}
              style={{ opacity: h <= lives ? 1 : 0.3 }} />
          ))}
        </div>
        <span className="text-white font-bold text-sm">Score: <span style={{ color: '#FBBF24' }}>{score}</span></span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FEEDBACK POPUP
// ═══════════════════════════════════════════════════════════════

function FeedbackPopup({ feedback, onClose }) {
  if (!feedback) return null;
  const isCorrect = feedback.type === 'correct';
  const bg = isCorrect ? '#6B8E3D' : '#B84A3D';
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="mx-4 max-w-md p-6 rounded-2xl shadow-2xl text-center bg-white"
        style={{ border: '2px solid #2C1810', animation: 'fadeInUp 0.3s ease-out' }}
        onClick={e => e.stopPropagation()}>
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-3" style={{ background: bg }}>
          {isCorrect ? <Check className="text-white" size={24} /> : <X className="text-white" size={24} />}
        </div>
        <p className="text-sm leading-relaxed italic" style={{ color: '#2C1810' }}>{feedback.text}</p>
        <button onClick={onClose} className="mt-4 px-6 py-2 rounded-xl text-white font-bold italic hover:brightness-90 active:scale-95"
          style={{ background: bg, border: '2px solid #2C1810', boxShadow: '0 3px 0 rgba(0,0,0,0.2)' }}>
          OK
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DEBUG NAV (Ctrl+D)
// ═══════════════════════════════════════════════════════════════

function DebugNav({ visible, currentScreen, onNavigate, onClose }) {
  if (!visible) return null;
  const menuItems = [
    { section: 'Missie 1: Meten aan de koelmachine' },
    { screen: 'm1r1', label: 'Ronde 1.1: Begeleid meten' },
    { screen: 'm1r1_check', label: 'Check 1.1', isCheck: true },
    { screen: 'm1r2', label: 'Ronde 1.2: Zelfstandig meten' },
    { screen: 'm1r2_check', label: 'Check 1.2', isCheck: true },
    { section: 'Missie 2: R-134a intekenen' },
    { screen: 'm2r1', label: 'Ronde 2.1: Begeleid intekenen' },
    { screen: 'm2r1_check', label: 'Check 2.1', isCheck: true },
    { screen: 'm2r2', label: 'Ronde 2.2: Zelf intekenen + EER/COP' },
    { screen: 'm2r2_check', label: 'Check 2.2', isCheck: true },
    { screen: 'm2r3', label: 'Ronde 2.3: Oververhitting & onderkoeling' },
    { screen: 'm2r3_check', label: 'Check 2.3', isCheck: true },
  ];
  const navBtn = (screen, label, bg, color) => (
    <button key={screen} onClick={() => onNavigate(screen)}
      className="w-full text-left px-4 py-2.5 rounded-lg font-semibold text-sm hover:brightness-90 active:scale-[0.98] transition-all"
      style={{ background: currentScreen === screen ? '#FBBF24' : bg, color: currentScreen === screen ? '#2C1810' : color }}>
      {label}
    </button>
  );
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="rounded-2xl p-6 w-80 max-h-[85vh] overflow-y-auto" style={{ background: '#F5EDD6', border: '3px solid #2C1810' }}>
        <div className="flex justify-between items-center mb-5">
          <span className="text-lg font-extrabold" style={{ color: '#2C1810' }}>Snelmenu (Ctrl+D)</span>
          <button onClick={onClose} className="hover:opacity-70" style={{ color: '#2C1810' }}><X size={20} /></button>
        </div>
        <div className="space-y-1.5">
          {menuItems.map((item, i) => {
            if (item.section) return <p key={i} className="text-sm font-bold pt-3 pb-1 first:pt-0" style={{ color: '#5C3A21' }}>{item.section}</p>;
            if (item.isCheck) return navBtn(item.screen, item.label, '#FBBF24', '#2C1810');
            return navBtn(item.screen, item.label, '#5C3A21', 'white');
          })}
        </div>
        <div className="mt-4 pt-3 space-y-1.5" style={{ borderTop: '1px solid #d4c9a8' }}>
          {navBtn('start', 'Startscherm', '#B84A3D', 'white')}
          {navBtn('end', 'Eindscherm', '#B84A3D', 'white')}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// QUIZ CHECK
// ═══════════════════════════════════════════════════════════════

function QuizCheck({ quizQs, maxPoints, onComplete, onLoseLife, lives }) {
  const [qIdx, setQIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [checked, setChecked] = useState(false);
  const [attemptsThisQ, setAttemptsThisQ] = useState(0);
  const [questionDone, setQuestionDone] = useState(false);
  const [totalPoints, setTotalPoints] = useState(0);

  const quizQ = quizQs[qIdx];
  const isLast = qIdx === quizQs.length - 1;
  const perQuestionMax = { first: Math.ceil(maxPoints.first / quizQs.length), second: Math.ceil(maxPoints.second / quizQs.length) };

  const handleCheck = () => {
    if (selected === null || lives <= 0) return;
    const isCorrect = selected === quizQ.correct;
    const newAttempts = attemptsThisQ + 1;
    setAttemptsThisQ(newAttempts);
    setChecked(true);
    if (isCorrect) {
      const pts = newAttempts === 1 ? perQuestionMax.first : perQuestionMax.second;
      setTotalPoints(p => p + pts);
      setQuestionDone(true);
    } else {
      onLoseLife?.();
    }
  };

  const handleRetry = () => { setSelected(null); setChecked(false); };
  const handleNext = () => {
    if (isLast) { onComplete(totalPoints); }
    else { setQIdx(i => i + 1); setSelected(null); setChecked(false); setAttemptsThisQ(0); setQuestionDone(false); }
  };

  const isCorrect = checked && selected === quizQ.correct;
  const isWrong = checked && !isCorrect;

  return (
    <div className="max-w-lg mx-auto" style={{ animation: 'fadeInUp 0.4s ease-out' }}>
      <div className="bg-white rounded-2xl p-6" style={{ border: '2px solid #2C1810', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
        <p className="text-xs font-bold mb-2" style={{ color: '#5C3A21' }}>Vraag {qIdx + 1} van {quizQs.length}</p>
        <h3 className="text-lg font-bold italic mb-4" style={{ color: '#2C1810' }}>{quizQ.question}</h3>
        <div className="space-y-2 mb-4">
          {quizQ.options.map((opt, i) => {
            let optStyle = { border: '2px solid #e8e0c8', background: '#FAFAF5' };
            if (selected === i && !checked) optStyle = { border: '2px solid #5C3A21', background: '#f0e8d0' };
            if (checked && isCorrect && i === quizQ.correct) optStyle = { border: '2px solid #6B8E3D', background: 'rgba(107,142,61,0.1)' };
            if (checked && selected === i && i !== quizQ.correct) optStyle = { border: '2px solid #B84A3D', background: 'rgba(184,74,61,0.1)' };
            return (
              <button key={i} disabled={questionDone || checked} onClick={() => setSelected(i)}
                className="w-full text-left px-4 py-3 rounded-xl text-sm transition-all hover:brightness-95 cursor-pointer" style={optStyle}>
                <span style={{ color: '#2C1810' }}>{opt}</span>
                {checked && isCorrect && i === quizQ.correct && <Check className="inline ml-2" size={16} style={{ color: '#6B8E3D' }} />}
                {checked && selected === i && i !== quizQ.correct && <X className="inline ml-2" size={16} style={{ color: '#B84A3D' }} />}
              </button>
            );
          })}
        </div>
        {checked && (
          <div className="p-3 rounded-xl text-sm mb-3 text-white italic" style={{ background: isCorrect ? '#6B8E3D' : '#B84A3D' }}>
            {isCorrect ? quizQ.feedbackCorrect : quizQ.feedbackWrong}
          </div>
        )}
        {!checked && !questionDone && (
          <button onClick={handleCheck} disabled={selected === null}
            className="w-full py-3 rounded-xl font-bold italic text-white hover:brightness-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: '#5C3A21', border: '2px solid #2C1810', boxShadow: '0 3px 0 rgba(0,0,0,0.2)' }}>
            Controleer
          </button>
        )}
        {isWrong && lives > 0 && (
          <button onClick={handleRetry}
            className="w-full py-3 rounded-xl font-bold italic text-white hover:brightness-90 active:scale-95"
            style={{ background: '#B84A3D', border: '2px solid #2C1810', boxShadow: '0 3px 0 rgba(0,0,0,0.2)' }}>
            Probeer opnieuw
          </button>
        )}
        {questionDone && (
          <button onClick={handleNext}
            className="w-full py-3 rounded-xl font-bold italic text-white hover:brightness-90 active:scale-95 flex items-center justify-center gap-2"
            style={{ background: '#5C3A21', border: '2px solid #2C1810', boxShadow: '0 3px 0 #3d2615' }}>
            {isLast ? 'Verder' : 'Volgende vraag'} <ChevronRight size={18} />
          </button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// R-134a DIAGRAM (SVG)
// ═══════════════════════════════════════════════════════════════

function R134aDiagram({ children, lines = {}, points = {}, onDiagramClick, showCrosshair = true, activeTool = null, showReadout = true, svgRef, onElementPointerDown, draggableElements = false }) {
  const [crosshair, setCrosshair] = useState(null);
  const handleMove = (e) => {
    if (!showCrosshair) return;
    const svg = svgRef?.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * SVG_W;
    const y = ((e.clientY - rect.top) / rect.height) * SVG_H;
    if (x >= PLOT.left && x <= PLOT.right && y >= PLOT.top && y <= PLOT.bottom) {
      setCrosshair({ x, y, h: xToEnthalpy(x), P: yToPressure(y), T: lookupTemp(xToEnthalpy(x), yToPressure(y)) });
    } else { setCrosshair(null); }
  };
  const handleClick = (e) => {
    if (!onDiagramClick) return;
    const svg = svgRef?.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * SVG_W;
    const y = ((e.clientY - rect.top) / rect.height) * SVG_H;
    if (x >= PLOT.left && x <= PLOT.right && y >= PLOT.top && y <= PLOT.bottom) {
      onDiagramClick({ x, y, h: xToEnthalpy(x), P: yToPressure(y), T: lookupTemp(xToEnthalpy(x), yToPressure(y)) });
    }
  };

  const handleElementDown = (e, target) => {
    if (!draggableElements || !onElementPointerDown) return;
    e.stopPropagation();
    e.preventDefault();
    onElementPointerDown(target, e);
  };

  const bootjePointPositions = {};
  ['p1', 'p2', 'p3', 'p4'].forEach(key => {
    if (points[key]) { const [px, py] = hpToXY(points[key].h, points[key].P); bootjePointPositions[key] = { x: px, y: py }; }
  });

  return (
    <div className="relative" style={{ cursor: activeTool ? 'crosshair' : 'default' }}>
      <svg ref={svgRef} viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full"
        style={{ backgroundColor: '#FAFAF5', borderRadius: 12, border: '2px solid #2C1810', maxHeight: 560 }}
        onMouseMove={handleMove} onMouseLeave={() => setCrosshair(null)} onClick={handleClick}>
        <rect x={PLOT.left} y={PLOT.top} width={PLOT_W} height={PLOT_H} fill="#FFFDF5" stroke="#2C1810" strokeWidth="1.5" />
        {P_GRID.map(p => { const y = pressureToY(p); return <g key={`pg${p}`}><line x1={PLOT.left} y1={y} x2={PLOT.right} y2={y} stroke="#ddd" strokeWidth="1" strokeDasharray="4 4" /><text x={PLOT.left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#5C3A21" fontFamily="Nunito" fontWeight="600">{p}</text></g>; })}
        {H_GRID.map(h => { const x = enthalpyToX(h); return <g key={`hg${h}`}><line x1={x} y1={PLOT.top} x2={x} y2={PLOT.bottom} stroke="#ddd" strokeWidth="1" strokeDasharray="4 4" /><text x={x} y={PLOT.bottom + 18} textAnchor="middle" fontSize="11" fill="#5C3A21" fontFamily="Nunito" fontWeight="600">{h}</text></g>; })}
        <text x={30} y={SVG_H / 2} textAnchor="middle" fontSize="13" fill="#2C1810" fontWeight="700" fontFamily="Nunito" transform={`rotate(-90, 30, ${SVG_H / 2})`}>Druk P (bar abs) — log-schaal</text>
        <text x={(PLOT.left + PLOT.right) / 2} y={SVG_H - 10} textAnchor="middle" fontSize="13" fill="#2C1810" fontWeight="700" fontFamily="Nunito">Enthalpie h (kJ/kg)</text>
        {ISOTHERM_PATHS.map(iso => (<g key={`iso-${iso.T}`}><path d={iso.path} fill="none" stroke="#A855F7" strokeWidth="1" strokeDasharray="3 4" opacity="0.5" /><text x={iso.labelPos.x} y={iso.labelPos.y} fontSize="9" fill="#A855F7" fontWeight="600" fontFamily="Nunito" textAnchor="end">{iso.T}°C</text></g>))}
        <path d={DOME_PATH} fill="rgba(168, 85, 247, 0.08)" />
        <path d={LIQUID_PATH} fill="none" stroke="#3B82F6" strokeWidth="2.5" />
        <path d={VAPOR_PATH} fill="none" stroke="#EF4444" strokeWidth="2.5" />
        <circle cx={hpToXY(CRITICAL_POINT.h, CRITICAL_POINT.P)[0]} cy={hpToXY(CRITICAL_POINT.h, CRITICAL_POINT.P)[1]} r="5" fill="#2C1810" stroke="#fff" strokeWidth="1.5" />
        <text x={hpToXY(CRITICAL_POINT.h, CRITICAL_POINT.P)[0] + 10} y={hpToXY(CRITICAL_POINT.h, CRITICAL_POINT.P)[1] - 6} fontSize="11" fontWeight="700" fill="#2C1810" fontFamily="Nunito">K</text>
        {lines.highP && (() => { const y = pressureToY(lines.highP); return <g style={{ cursor: draggableElements ? 'grab' : 'default' }} onPointerDown={(e) => handleElementDown(e, 'highP')}>
          {/* Wide invisible hit area for easier grabbing */}
          <line x1={PLOT.left} y1={y} x2={PLOT.right} y2={y} stroke="transparent" strokeWidth="18" />
          <line x1={PLOT.left} y1={y} x2={PLOT.right} y2={y} stroke="#991B1B" strokeWidth="2" strokeDasharray="6 4" />
          <text x={PLOT.right + 4} y={y + 4} fontSize="10" fill="#991B1B" fontWeight="bold" fontFamily="Nunito">HP {fmtNum(lines.highP, 1)}</text>
        </g>; })()}
        {lines.lowP && (() => { const y = pressureToY(lines.lowP); return <g style={{ cursor: draggableElements ? 'grab' : 'default' }} onPointerDown={(e) => handleElementDown(e, 'lowP')}>
          <line x1={PLOT.left} y1={y} x2={PLOT.right} y2={y} stroke="transparent" strokeWidth="18" />
          <line x1={PLOT.left} y1={y} x2={PLOT.right} y2={y} stroke="#1E3A8A" strokeWidth="2" strokeDasharray="6 4" />
          <text x={PLOT.right + 4} y={y + 4} fontSize="10" fill="#1E3A8A" fontWeight="bold" fontFamily="Nunito">LP {fmtNum(lines.lowP, 1)}</text>
        </g>; })()}
        {bootjePointPositions.p1 && bootjePointPositions.p2 && <line x1={bootjePointPositions.p1.x} y1={bootjePointPositions.p1.y} x2={bootjePointPositions.p2.x} y2={bootjePointPositions.p2.y} stroke="#2563EB" strokeWidth="3" strokeLinecap="round" />}
        {bootjePointPositions.p2 && bootjePointPositions.p3 && <line x1={bootjePointPositions.p2.x} y1={bootjePointPositions.p2.y} x2={bootjePointPositions.p3.x} y2={bootjePointPositions.p3.y} stroke="#DC2626" strokeWidth="3" strokeLinecap="round" />}
        {bootjePointPositions.p3 && bootjePointPositions.p4 && <line x1={bootjePointPositions.p3.x} y1={bootjePointPositions.p3.y} x2={bootjePointPositions.p4.x} y2={bootjePointPositions.p4.y} stroke="#7C3AED" strokeWidth="3" strokeLinecap="round" />}
        {bootjePointPositions.p4 && bootjePointPositions.p1 && <line x1={bootjePointPositions.p4.x} y1={bootjePointPositions.p4.y} x2={bootjePointPositions.p1.x} y2={bootjePointPositions.p1.y} stroke="#059669" strokeWidth="3" strokeLinecap="round" />}
        {['p1', 'p2', 'p3', 'p4'].map(key => {
          const pt = bootjePointPositions[key];
          if (!pt) return null;
          const isDraggable = draggableElements && key !== 'p4'; // p4 is auto-placed
          return (<g key={key} style={{ cursor: isDraggable ? 'grab' : 'default' }} onPointerDown={(e) => isDraggable && handleElementDown(e, key)}>
            {isDraggable && <circle cx={pt.x} cy={pt.y} r="18" fill="transparent" />}
            <circle cx={pt.x} cy={pt.y} r="10" fill="white" stroke="#2C1810" strokeWidth="2" />
            <text x={pt.x} y={pt.y + 4} textAnchor="middle" fontSize="11" fontWeight="bold" fill="#2C1810" fontFamily="Nunito" pointerEvents="none">{key.substring(1)}</text>
          </g>);
        })}
        {crosshair && showCrosshair && (
          <g pointerEvents="none">
            <line x1={PLOT.left} y1={crosshair.y} x2={PLOT.right} y2={crosshair.y} stroke="#2C1810" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.5" />
            <line x1={crosshair.x} y1={PLOT.top} x2={crosshair.x} y2={PLOT.bottom} stroke="#2C1810" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.5" />
            <circle cx={crosshair.x} cy={crosshair.y} r="3" fill="#FBBF24" stroke="#2C1810" strokeWidth="1" />
          </g>
        )}
        {children}
      </svg>
      {showReadout && crosshair && (
        <div className="absolute top-3 right-3 bg-white rounded-lg px-3 py-2 text-xs font-mono" style={{ border: '2px solid #2C1810', boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }}>
          <div className="flex items-center gap-1"><Thermometer size={12} style={{ color: '#B84A3D' }} /> <span style={{ color: '#2C1810', fontWeight: 700 }}>{fmtNum(crosshair.T, 0)} °C</span></div>
          <div style={{ color: '#5C3A21' }}>P abs: <span className="font-bold" style={{ color: '#2C1810' }}>{fmtNum(crosshair.P, 1)} bar</span></div>
          <div style={{ color: '#5C3A21' }}>h: <span className="font-bold" style={{ color: '#2C1810' }}>{fmtNum(crosshair.h, 0)} kJ/kg</span></div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// COOLING MACHINE SCHEMATIC SVG
// Layout: Condensor boven, verdamper onder, compressor rechts, expansieventiel links
// ═══════════════════════════════════════════════════════════════

function CoolingMachineSchematic({ onPointClick, activePointId, revealedPoints = {}, highlightPointId = null }) {
  const W = 750, H = 540;

  // Component positions — more spread out
  const condensor = { x: 340, y: 65, w: 180, h: 55 };
  const verdamper = { x: 340, y: 430, w: 180, h: 55 };
  const compressor = { x: 630, y: 250, r: 45 };
  const expansie = { x: 80, y: 250, w: 40, h: 50 };

  // Pipe coordinates (derived from components)
  const pipeHP_y = condensor.y + condensor.h / 2;    // horizontal HP pipe y
  const pipeLP_y = verdamper.y + verdamper.h / 2;    // horizontal LP pipe y

  // Measurement point positions — ON the pipes, well spaced
  // labelDir: direction for label text (above/below), valueDir: direction for value box
  const mpPositions = {
    hp:     { x: 480, y: pipeHP_y, labelDir: 'below', valueDir: 'below' },     // HP pipe, between condensor and compressor
    lp:     { x: 480, y: pipeLP_y, labelDir: 'above', valueDir: 'above' },     // LP pipe, between verdamper and compressor
    t_cond: { x: 340, y: condensor.y - 6, labelDir: 'above', valueDir: 'right' },  // above condensor
    t_verd: { x: 340, y: verdamper.y + verdamper.h + 6, labelDir: 'below', valueDir: 'right' },  // below verdamper
    t_comp: { x: compressor.x, y: 155, labelDir: 'left', valueDir: 'left' },   // on vertical persleiding above compressor
    t_exp:  { x: 180, y: pipeHP_y, labelDir: 'above', valueDir: 'above' },     // on horizontal vloeistofleiding
    t_zuig: { x: compressor.x, y: 385, labelDir: 'left', valueDir: 'left' },   // on vertical zuigleiding below compressor
  };

  const handleClick = (id) => {
    if (onPointClick) onPointClick(id);
  };

  const r = 14; // measurement point radius

  // Render a value label at the correct position
  const renderValueLabel = (mp, pos) => {
    const dir = pos.valueDir;
    const boxW = 68, boxH = 22;
    let bx, by;
    if (dir === 'right') { bx = pos.x + r + 6; by = pos.y - boxH / 2; }
    else if (dir === 'left') { bx = pos.x - r - 6 - boxW; by = pos.y - boxH / 2; }
    else if (dir === 'below') { bx = pos.x - boxW / 2; by = pos.y + r + 4; }
    else { /* above */ bx = pos.x - boxW / 2; by = pos.y - r - 4 - boxH; }
    return (
      <g style={{ animation: 'pop-in 0.3s ease-out' }}>
        <rect x={bx} y={by} width={boxW} height={boxH} rx="6" fill={mp.color} />
        <text x={bx + boxW / 2} y={by + boxH / 2 + 4} textAnchor="middle" fontSize="11" fontWeight="800" fill="white" fontFamily="Nunito">{mp.value}</text>
      </g>
    );
  };

  // Render the shortLabel at correct position
  const renderLabel = (mp, pos) => {
    const dir = pos.labelDir;
    let lx = pos.x, ly;
    let anchor = 'middle';
    if (dir === 'below') { ly = pos.y + r + 13; }
    else if (dir === 'above') { ly = pos.y - r - 5; }
    else if (dir === 'left') { lx = pos.x - r - 5; ly = pos.y + 4; anchor = 'end'; }
    else { lx = pos.x + r + 5; ly = pos.y + 4; anchor = 'start'; }
    return <text x={lx} y={ly} textAnchor={anchor} fontSize="9" fontWeight="700" fill={mp.color} fontFamily="Nunito">{mp.shortLabel}</text>;
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: H }}>
      <rect x="0" y="0" width={W} height={H} fill="#FAFAF5" rx="12" />

      {/* ── Leidingen (pipes) ── */}
      {/* Persleiding: compressor top → up → left to condensor right */}
      <path d={`M ${compressor.x} ${compressor.y - compressor.r} L ${compressor.x} ${pipeHP_y} L ${condensor.x + condensor.w / 2} ${pipeHP_y}`}
        fill="none" stroke="#991B1B" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <polygon points={`${compressor.x - 6},${compressor.y - compressor.r - 25} ${compressor.x + 6},${compressor.y - compressor.r - 25} ${compressor.x},${compressor.y - compressor.r - 35}`} fill="#991B1B" />

      {/* Vloeistofleiding: condensor left → left to expansie → down to expansie top */}
      <path d={`M ${condensor.x - condensor.w / 2} ${pipeHP_y} L ${expansie.x} ${pipeHP_y} L ${expansie.x} ${expansie.y - expansie.h / 2}`}
        fill="none" stroke="#DC2626" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <polygon points={`${expansie.x - 6},${expansie.y - expansie.h / 2 - 10} ${expansie.x + 6},${expansie.y - expansie.h / 2 - 10} ${expansie.x},${expansie.y - expansie.h / 2}`} fill="#DC2626" />

      {/* Leiding expansieventiel → verdamper */}
      <path d={`M ${expansie.x} ${expansie.y + expansie.h / 2} L ${expansie.x} ${pipeLP_y} L ${verdamper.x - verdamper.w / 2} ${pipeLP_y}`}
        fill="none" stroke="#1E3A8A" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <polygon points={`${expansie.x - 6},${expansie.y + expansie.h / 2 + 20} ${expansie.x + 6},${expansie.y + expansie.h / 2 + 20} ${expansie.x},${expansie.y + expansie.h / 2 + 30}`} fill="#1E3A8A" />

      {/* Zuigleiding: verdamper right → right to compressor → up to compressor bottom */}
      <path d={`M ${verdamper.x + verdamper.w / 2} ${pipeLP_y} L ${compressor.x} ${pipeLP_y} L ${compressor.x} ${compressor.y + compressor.r}`}
        fill="none" stroke="#059669" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <polygon points={`${compressor.x - 6},${compressor.y + compressor.r + 25} ${compressor.x + 6},${compressor.y + compressor.r + 25} ${compressor.x},${compressor.y + compressor.r + 15}`} fill="#059669" />

      {/* ── Componenten ── */}
      {/* Condensor */}
      <rect x={condensor.x - condensor.w / 2} y={condensor.y} width={condensor.w} height={condensor.h}
        rx="10" fill="white" stroke="#DC2626" strokeWidth="3" />
      <text x={condensor.x} y={condensor.y + 23} textAnchor="middle" fontSize="14" fontWeight="800" fill="#DC2626" fontFamily="Nunito">Condensor</text>
      <text x={condensor.x} y={condensor.y + 40} textAnchor="middle" fontSize="10" fill="#DC2626" fontFamily="Nunito" opacity="0.7">warmte afvoer</text>
      <g transform={`translate(${condensor.x + condensor.w / 2 + 20}, ${condensor.y + condensor.h / 2 - 10})`}>
        <Wind size={18} style={{ color: '#DC2626' }} />
      </g>

      {/* Verdamper */}
      <rect x={verdamper.x - verdamper.w / 2} y={verdamper.y} width={verdamper.w} height={verdamper.h}
        rx="10" fill="white" stroke="#0891B2" strokeWidth="3" />
      <text x={verdamper.x} y={verdamper.y + 23} textAnchor="middle" fontSize="14" fontWeight="800" fill="#0891B2" fontFamily="Nunito">Verdamper</text>
      <text x={verdamper.x} y={verdamper.y + 40} textAnchor="middle" fontSize="10" fill="#0891B2" fontFamily="Nunito" opacity="0.7">warmte opname</text>
      <g transform={`translate(${verdamper.x + verdamper.w / 2 + 20}, ${verdamper.y + verdamper.h / 2 - 10})`}>
        <Snowflake size={18} style={{ color: '#0891B2' }} />
      </g>

      {/* Compressor */}
      <circle cx={compressor.x} cy={compressor.y} r={compressor.r}
        fill="white" stroke="#2563EB" strokeWidth="3" />
      <text x={compressor.x} y={compressor.y - 5} textAnchor="middle" fontSize="13" fontWeight="800" fill="#2563EB" fontFamily="Nunito">Compressor</text>
      <text x={compressor.x} y={compressor.y + 12} textAnchor="middle" fontSize="10" fill="#2563EB" fontFamily="Nunito" opacity="0.7">drukverhoging</text>

      {/* Expansieventiel */}
      <rect x={expansie.x - expansie.w / 2} y={expansie.y - expansie.h / 2} width={expansie.w} height={expansie.h}
        rx="6" fill="white" stroke="#7C3AED" strokeWidth="3" />
      <text x={expansie.x} y={expansie.y - 35} textAnchor="middle" fontSize="11" fontWeight="800" fill="#7C3AED" fontFamily="Nunito">Expansie-</text>
      <text x={expansie.x} y={expansie.y - 23} textAnchor="middle" fontSize="11" fontWeight="800" fill="#7C3AED" fontFamily="Nunito">ventiel</text>
      <path d={`M ${expansie.x - 12} ${expansie.y - 8} L ${expansie.x} ${expansie.y + 8} L ${expansie.x + 12} ${expansie.y - 8}`}
        fill="none" stroke="#7C3AED" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* Gebiedslabels */}
      <text x={520} y={pipeHP_y - 18} textAnchor="middle" fontSize="9" fill="#991B1B" fontFamily="Nunito" fontWeight="600" opacity="0.5">HOGEDRUKZIJDE</text>
      <text x={520} y={pipeLP_y + 26} textAnchor="middle" fontSize="9" fill="#1E3A8A" fontFamily="Nunito" fontWeight="600" opacity="0.5">LAGEDRUKZIJDE</text>

      {/* ── Meetpunten ── */}
      {MEASUREMENT_POINTS.map(mp => {
        const pos = mpPositions[mp.id];
        if (!pos) return null;
        const isActive = activePointId === mp.id;
        const isRevealed = revealedPoints[mp.id];
        const isHighlight = highlightPointId === mp.id;

        return (
          <g key={mp.id} onClick={() => handleClick(mp.id)} style={{ cursor: 'pointer' }}>
            {(isActive || isHighlight) && !isRevealed && (
              <circle cx={pos.x} cy={pos.y} r={r + 4} fill="none" stroke={mp.color} strokeWidth="2" opacity="0.6">
                <animate attributeName="r" from={r + 2} to={r + 14} dur="1.2s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.8" to="0" dur="1.2s" repeatCount="indefinite" />
              </circle>
            )}
            <circle cx={pos.x} cy={pos.y} r={r}
              fill={isRevealed ? mp.color : 'white'}
              stroke={mp.color} strokeWidth="2.5"
              opacity={isRevealed ? 0.9 : 1} />
            {!isRevealed ? (
              <text x={pos.x} y={pos.y + 4} textAnchor="middle" fontSize="10" fontWeight="800" fill={mp.color} fontFamily="Nunito">?</text>
            ) : (
              <text x={pos.x} y={pos.y + 5} textAnchor="middle" fontSize="11" fontWeight="800" fill="white" fontFamily="Nunito">✓</text>
            )}
            {renderLabel(mp, pos)}
            {isRevealed && renderValueLabel(mp, pos)}
          </g>
        );
      })}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════
// M1 INTRO
// ═══════════════════════════════════════════════════════════════

function M1IntroScreen({ onBegin }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#F5EDD6' }}>
      <div className="max-w-lg bg-white rounded-2xl p-8" style={{ border: '2px solid #2C1810', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', animation: 'fadeInUp 0.5s ease-out' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(251,191,36,0.2)' }}>
            <Gauge size={22} style={{ color: '#5C3A21' }} />
          </div>
          <h2 className="text-xl font-extrabold" style={{ color: '#2C1810' }}>Missie 1 — Meten aan de koelmachine</h2>
        </div>
        <div className="italic leading-relaxed mb-6" style={{ color: '#5C3A21', lineHeight: 1.7 }}>
          <p className="font-extrabold text-lg mb-3" style={{ color: '#2C1810' }}>De koelmachine draait. Tijd om te meten!</p>
          <p className="mb-2">Je staat voor een draaiende koelinstallatie met R-134a. Je gaat de belangrijkste meetgegevens verzamelen:</p>
          <ul className="list-disc pl-6 mb-3 space-y-0.5">
            <li>Drukken aflezen van de manometers</li>
            <li>Temperaturen meten op de juiste plekken</li>
          </ul>
          <p>Deze meetgegevens heb je straks nodig om het <span className="inline-block px-2 py-0.5 font-bold rounded" style={{ background: '#FBBF24', color: '#2C1810' }}>bootje</span> in het h-log p diagram te tekenen.</p>
        </div>
        <button onClick={onBegin}
          className="w-full py-3 text-white rounded-xl font-bold italic hover:brightness-90 active:scale-95 flex items-center justify-center gap-2"
          style={{ background: '#5C3A21', border: '2px solid #2C1810', boxShadow: '0 3px 0 #3d2615' }}>
          Begin <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// M2 INTRO
// ═══════════════════════════════════════════════════════════════

function M2IntroScreen({ onBegin }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#F5EDD6' }}>
      <div className="max-w-lg bg-white rounded-2xl p-8" style={{ border: '2px solid #2C1810', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', animation: 'fadeInUp 0.5s ease-out' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(251,191,36,0.2)' }}>
            <Target size={22} style={{ color: '#5C3A21' }} />
          </div>
          <h2 className="text-xl font-extrabold" style={{ color: '#2C1810' }}>Missie 2 — Het R-134a diagram</h2>
        </div>
        <div className="italic leading-relaxed mb-6" style={{ color: '#5C3A21', lineHeight: 1.7 }}>
          <p className="font-extrabold text-lg mb-2" style={{ color: '#2C1810' }}>Nu wordt het serieus.</p>
          <p className="mb-2">Je gaat werken in een echt h-log p diagram van koudemiddel <span className="font-bold">R-134a</span>.</p>
          <p className="mb-2">Jouw taak: teken het bootje met de meetgegevens uit missie 1.</p>
          <p>Vul deze goed in. Want dan lees je nauwkeurig het rendement en weet je of de machine goed draait.</p>
        </div>
        <button onClick={onBegin}
          className="w-full py-3 text-white rounded-xl font-bold italic hover:brightness-90 active:scale-95 flex items-center justify-center gap-2"
          style={{ background: '#5C3A21', border: '2px solid #2C1810', boxShadow: '0 3px 0 #3d2615' }}>
          Aan de slag <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// M1R1 — GUIDED MEASUREMENT
// Stap voor stap meten aan de koelmachine
// ═══════════════════════════════════════════════════════════════

function GuidedMeasurement({ onComplete, onLoseLife, lives }) {
  const [step, setStep] = useState(0);
  const [revealed, setRevealed] = useState({});
  const [attempts, setAttempts] = useState(Array(7).fill(0));
  const [feedbackText, setFeedbackText] = useState(null);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [finished, setFinished] = useState(false);

  const MAX_ATTEMPTS = 3;

  const stepDefs = [
    { id: 'hp', instruction: 'Lees de hoge druk af', desc: 'Klik op de manometer aan de hogedrukzijde (persleiding).' },
    { id: 'lp', instruction: 'Lees de lage druk af', desc: 'Klik op de manometer aan de lagedrukzijde (zuigleiding).' },
    { id: 't_verd', instruction: 'Meet de verdampingstemperatuur', desc: 'Klik op het meetpunt bij de verdamper.' },
    { id: 't_cond', instruction: 'Meet de condensatietemperatuur', desc: 'Klik op het meetpunt bij de condensor.' },
    { id: 't_comp', instruction: 'Meet de eindcompressietemperatuur', desc: 'Klik op het meetpunt bij de persleiding (uit compressor).' },
    { id: 't_exp', instruction: 'Meet de temperatuur voor het expansieventiel', desc: 'Klik op het meetpunt bij de vloeistofleiding (voor expansieventiel).' },
    { id: 't_zuig', instruction: 'Meet de zuigleidingtemperatuur', desc: 'Klik op het meetpunt bij de zuigleiding (naar compressor).' },
  ];

  const currentStep = stepDefs[step];

  const handlePointClick = (pointId) => {
    if (finished || !currentStep) return;
    const newAtt = [...attempts];
    newAtt[step] = newAtt[step] + 1;
    setAttempts(newAtt);

    if (pointId === currentStep.id) {
      // Correct!
      setRevealed(prev => ({ ...prev, [pointId]: true }));
      const mp = MEASUREMENT_POINTS.find(m => m.id === pointId);
      setPointsEarned(p => p + (newAtt[step] <= 1 ? SCORING.m1r1.perStep : 0));
      setFeedbackText({ type: 'correct', text: `Goed! ${mp.label}: ${mp.value}.` });
      setTimeout(() => {
        setFeedbackText(null);
        if (step < stepDefs.length - 1) setStep(step + 1);
        else setFinished(true);
      }, 1200);
    } else {
      // Wrong
      if (newAtt[step] >= MAX_ATTEMPTS) {
        // Auto-reveal
        setRevealed(prev => ({ ...prev, [currentStep.id]: true }));
        const mp = MEASUREMENT_POINTS.find(m => m.id === currentStep.id);
        setFeedbackText({ type: 'autocomplete', text: `Dat is niet het juiste meetpunt. Het juiste punt wordt getoond: ${mp.label} = ${mp.value}.` });
        setTimeout(() => {
          setFeedbackText(null);
          if (step < stepDefs.length - 1) setStep(step + 1);
          else setFinished(true);
        }, 2000);
      } else {
        onLoseLife?.();
        setFeedbackText({ type: 'wrong', text: 'Dat is niet het juiste meetpunt. Probeer opnieuw!' });
        setTimeout(() => setFeedbackText(null), 1500);
      }
    }
  };

  return (
    <div className="min-h-screen p-4" style={{ background: '#F5EDD6' }}>
      <div className="max-w-5xl mx-auto" style={{ animation: 'fadeInUp 0.4s ease-out' }}>
        <div className="bg-white rounded-2xl p-5 mb-3" style={{ border: '2px solid #2C1810', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          <div className="flex items-start gap-3 mb-3">
            <div>
              <h3 className="text-lg font-extrabold mb-1" style={{ color: '#2C1810' }}>Ronde 1.1 — Begeleid meten</h3>
              <p className="text-xs italic" style={{ color: '#5C3A21' }}>Klik op het juiste meetpunt in het schema. De koelmachine draait!</p>
            </div>
            <div className="ml-auto text-right flex-shrink-0">
              <span className="text-xs font-bold" style={{ color: '#5C3A21' }}>Meetpunt {Math.min(step + 1, stepDefs.length)} / {stepDefs.length}</span>
              <div className="flex gap-1 mt-1">
                {stepDefs.map((_, i) => (
                  <div key={i} className="w-5 h-2 rounded-full" style={{ background: i < step ? '#6B8E3D' : (i === step ? '#FBBF24' : '#e8e0c8') }} />
                ))}
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-[1fr_260px] gap-4">
            <CoolingMachineSchematic
              onPointClick={finished ? undefined : handlePointClick}
              activePointId={currentStep?.id}
              revealedPoints={revealed}
            />
            <div className="space-y-3">
              {currentStep && !finished && (
                <div className="rounded-xl p-4" style={{ background: 'rgba(251,191,36,0.1)', border: '2px solid #FBBF24' }}>
                  <p className="font-bold text-sm mb-1" style={{ color: '#2C1810' }}>{currentStep.instruction}</p>
                  <p className="text-xs italic" style={{ color: '#5C3A21', lineHeight: 1.5 }}>{currentStep.desc}</p>
                  <p className="text-xs mt-2" style={{ color: '#5C3A21' }}>Pogingen: {attempts[step]} / {MAX_ATTEMPTS}</p>
                </div>
              )}
              {/* Show already revealed values */}
              {Object.keys(revealed).length > 0 && (
                <div className="rounded-xl p-3" style={{ background: 'rgba(107,142,61,0.05)', border: '1.5px solid #6B8E3D' }}>
                  <p className="text-xs font-bold mb-1" style={{ color: '#6B8E3D' }}>Gemeten waardes</p>
                  {MEASUREMENT_POINTS.filter(mp => revealed[mp.id]).map(mp => (
                    <div key={mp.id} className="text-xs flex justify-between" style={{ color: '#2C1810' }}>
                      <span>{mp.label}</span>
                      <span className="font-bold font-mono">{mp.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {feedbackText && (
            <div className="mt-3 p-3 rounded-xl text-sm italic text-white"
              style={{ background: feedbackText.type === 'correct' ? '#6B8E3D' : feedbackText.type === 'autocomplete' ? '#8B7355' : '#B84A3D', animation: 'fadeInUp 0.2s' }}>
              {feedbackText.text}
            </div>
          )}

          {finished && (
            <div className="mt-4 p-4 rounded-xl" style={{ background: 'rgba(107,142,61,0.1)', border: '2px solid #6B8E3D', animation: 'fadeInUp 0.3s' }}>
              <p className="italic mb-3" style={{ color: '#2C1810', lineHeight: 1.6 }}>
                <span className="font-bold">Goed gedaan!</span> Je hebt alle meetgegevens verzameld van de draaiende koelinstallatie. Nu ga je deze gegevens zelfstandig aflezen en noteren.
              </p>
              <button onClick={() => onComplete(pointsEarned)}
                className="w-full py-3 text-white rounded-xl font-bold italic hover:brightness-90 active:scale-95 flex items-center justify-center gap-2"
                style={{ background: '#5C3A21', border: '2px solid #2C1810', boxShadow: '0 3px 0 #3d2615' }}>
                Volgende <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// M1R2 — INDEPENDENT MEASUREMENT
// Speler klikt zelf op meetpunten en vult waarden in
// ═══════════════════════════════════════════════════════════════

function IndependentMeasurement({ onComplete, onLoseLife, lives }) {
  const [revealed, setRevealed] = useState({});
  const [highlightPoint, setHighlightPoint] = useState(null);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [finished, setFinished] = useState(false);

  // Form fields
  const fields = [
    { key: 'hp_eff', label: 'Hoge druk (effectief)', correct: 8.0, margin: 0.5, unit: 'bar', sourcePoint: 'hp' },
    { key: 'lp_eff', label: 'Lage druk (effectief)', correct: 2.0, margin: 0.5, unit: 'bar', sourcePoint: 'lp' },
    { key: 'hp_abs', label: 'Hoge druk (absoluut)', correct: 9.0, margin: 0.5, unit: 'bar', sourcePoint: null },
    { key: 'lp_abs', label: 'Lage druk (absoluut)', correct: 3.0, margin: 0.5, unit: 'bar', sourcePoint: null },
    { key: 't_verd', label: 'T verdamping', correct: 1, margin: 1, unit: '°C', sourcePoint: 't_verd' },
    { key: 't_cond', label: 'T condensatie', correct: 36, margin: 1, unit: '°C', sourcePoint: 't_cond' },
    { key: 't_comp', label: 'T eindcompressie', correct: 60, margin: 1, unit: '°C', sourcePoint: 't_comp' },
    { key: 't_exp', label: 'T voor expansie', correct: 25, margin: 1, unit: '°C', sourcePoint: 't_exp' },
    { key: 't_zuig', label: 'T zuigleiding', correct: 15, margin: 1, unit: '°C', sourcePoint: 't_zuig' },
  ];

  const [values, setValues] = useState(() => Object.fromEntries(fields.map(f => [f.key, ''])));
  const [validated, setValidated] = useState(() => Object.fromEntries(fields.map(f => [f.key, false])));
  const [attempts, setAttempts] = useState(() => Object.fromEntries(fields.map(f => [f.key, 0])));
  const [feedback, setFeedback] = useState(() => Object.fromEntries(fields.map(f => [f.key, null])));

  const allValidated = fields.every(f => validated[f.key]);

  const handlePointClick = (pointId) => {
    setRevealed(prev => ({ ...prev, [pointId]: true }));
  };

  const handleFieldFocus = (field) => {
    if (field.sourcePoint) setHighlightPoint(field.sourcePoint);
    else setHighlightPoint(null);
  };

  const handleCheck = (field) => {
    const v = parseNum(values[field.key]);
    if (Number.isNaN(v)) return;
    const diff = Math.abs(v - field.correct);
    const newAtt = attempts[field.key] + 1;
    setAttempts(prev => ({ ...prev, [field.key]: newAtt }));
    if (diff <= field.margin) {
      setValidated(prev => ({ ...prev, [field.key]: true }));
      setFeedback(prev => ({ ...prev, [field.key]: { type: 'correct' } }));
      if (newAtt === 1) setPointsEarned(p => p + SCORING.m1r2.perField);
    } else {
      onLoseLife?.();
      setFeedback(prev => ({ ...prev, [field.key]: { type: 'wrong', msg: `Niet juist. Verwacht: ${fmtNum(field.correct, field.correct % 1 === 0 ? 0 : 1)} ${field.unit}` } }));
    }
  };

  useEffect(() => {
    if (allValidated) setFinished(true);
  }, [allValidated]);

  return (
    <div className="min-h-screen p-4" style={{ background: '#F5EDD6' }}>
      <div className="max-w-6xl mx-auto" style={{ animation: 'fadeInUp 0.4s ease-out' }}>
        <div className="bg-white rounded-2xl p-5 mb-3" style={{ border: '2px solid #2C1810', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          <h3 className="text-lg font-extrabold mb-1" style={{ color: '#2C1810' }}>Ronde 1.2 — Zelfstandig meten</h3>
          <p className="text-sm italic mb-4" style={{ color: '#5C3A21' }}>
            Klik op de meetpunten in het schema om de waarden af te lezen. Vul ze in het formulier in. <span className="font-bold">Let op: de absolute druk moet je zelf berekenen!</span>
          </p>

          <div className="grid lg:grid-cols-[1fr_320px] gap-4">
            <CoolingMachineSchematic
              onPointClick={handlePointClick}
              revealedPoints={revealed}
              highlightPointId={highlightPoint}
            />
            <div className="space-y-1.5">
              <p className="text-xs font-bold mb-1" style={{ color: '#5C3A21' }}>Vul de meetgegevens in:</p>
              {fields.map(field => {
                const isDone = validated[field.key];
                const fb = feedback[field.key];
                return (
                  <div key={field.key} className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                    style={{
                      background: isDone ? 'rgba(107,142,61,0.08)' : 'white',
                      border: `1.5px solid ${isDone ? '#6B8E3D' : fb?.type === 'wrong' ? '#B84A3D' : '#e8e0c8'}`,
                    }}>
                    {isDone && <Check size={14} style={{ color: '#6B8E3D', flexShrink: 0 }} />}
                    <span className="text-xs flex-1" style={{ color: '#2C1810', fontWeight: isDone ? 700 : 400 }}>{field.label}</span>
                    {isDone ? (
                      <span className="text-xs font-bold font-mono" style={{ color: '#6B8E3D' }}>{fmtNum(parseNum(values[field.key]), field.correct % 1 === 0 ? 0 : 1)} {field.unit}</span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={values[field.key]}
                          onChange={(e) => setValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                          onFocus={() => handleFieldFocus(field)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleCheck(field); }}
                          className="w-16 px-1.5 py-0.5 rounded text-xs font-mono"
                          style={{ background: '#FAFAF5', border: '1.5px solid #5C3A21', color: '#2C1810' }}
                          placeholder="?"
                        />
                        <span className="text-xs" style={{ color: '#5C3A21' }}>{field.unit}</span>
                        <button onClick={() => handleCheck(field)} disabled={values[field.key] === ''}
                          className="px-2 py-0.5 rounded text-xs font-bold text-white hover:brightness-90 active:scale-95 disabled:opacity-40"
                          style={{ background: '#5C3A21', fontSize: 10 }}>
                          OK
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {/* Hints */}
              {Object.values(feedback).some(f => f?.type === 'wrong') && (
                <div className="p-2 rounded-lg text-xs italic text-white" style={{ background: '#B84A3D' }}>
                  {Object.entries(feedback).filter(([_, f]) => f?.type === 'wrong').map(([key, f]) => (
                    <div key={key}>{f.msg}</div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {finished && (
            <div className="mt-4 p-4 rounded-xl" style={{ background: 'rgba(107,142,61,0.1)', border: '2px solid #6B8E3D', animation: 'fadeInUp 0.3s' }}>
              <p className="italic mb-3" style={{ color: '#2C1810', lineHeight: 1.6 }}>
                <span className="font-bold">Uitstekend!</span> Alle meetgegevens zijn correct ingevuld. Met deze waardes ga je in de volgende missie het bootje tekenen in het h-log p diagram.
              </p>
              <button onClick={() => onComplete(pointsEarned)}
                className="w-full py-3 text-white rounded-xl font-bold italic hover:brightness-90 active:scale-95 flex items-center justify-center gap-2"
                style={{ background: '#5C3A21', border: '2px solid #2C1810', boxShadow: '0 3px 0 #3d2615' }}>
                Naar Missie 2 <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CALCULATION PANEL
// ═══════════════════════════════════════════════════════════════

function CalculationPanel({ steps, onAllDone, onLoseLife, lives, onStepChange, onStepValidated }) {
  const [values, setValues] = useState(() => Object.fromEntries(steps.map(s => [s.key, ''])));
  const [validated, setValidated] = useState(() => Object.fromEntries(steps.map(s => [s.key, false])));
  const [attempts, setAttempts] = useState(() => Object.fromEntries(steps.map(s => [s.key, 0])));
  const [activeIdx, setActiveIdx] = useState(0);
  const [expandedSteps, setExpandedSteps] = useState({});
  useEffect(() => { onStepChange?.(steps[activeIdx]?.key); }, [activeIdx]);
  const [feedbackMsg, setFeedbackMsg] = useState({});
  const [shakeKey, setShakeKey] = useState(null);

  const handleCheck = (idx) => {
    const step = steps[idx];
    const v = parseNum(values[step.key]);
    if (Number.isNaN(v)) return;
    const diff = Math.abs(v - step.correct);
    const newAttempts = attempts[step.key] + 1;
    setAttempts(prev => ({ ...prev, [step.key]: newAttempts }));
    if (diff <= step.margin) {
      setValidated(prev => ({ ...prev, [step.key]: true }));
      setFeedbackMsg(prev => ({ ...prev, [step.key]: { type: 'correct', msg: step.feedbackCorrect || 'Correct!' } }));
      onStepValidated?.(step.key, v);
      setTimeout(() => {
        if (idx < steps.length - 1) setActiveIdx(idx + 1);
        else onAllDone?.(values, attempts);
      }, 400);
    } else {
      onLoseLife?.();
      setShakeKey(step.key);
      setTimeout(() => setShakeKey(null), 500);
      setFeedbackMsg(prev => ({ ...prev, [step.key]: { type: 'wrong', msg: step.hint || 'Nog niet juist. Probeer opnieuw.' } }));
    }
  };

  return (
    <div className="space-y-2">
      {steps.map((step, idx) => {
        const isActive = idx === activeIdx;
        const isDone = validated[step.key];
        const isFuture = idx > activeIdx;
        const fb = feedbackMsg[step.key];
        const [expanded, setExpanded] = [expandedSteps?.[step.key], (v) => setExpandedSteps?.(prev => ({ ...prev, [step.key]: v }))];

        if (isDone && !isActive) {
          return (
            <div key={step.key} className="rounded-xl px-3 py-2 flex items-center gap-2 cursor-pointer hover:brightness-95 transition-all"
              style={{ background: 'rgba(107,142,61,0.08)', border: '1.5px solid #6B8E3D' }}
              onClick={() => setExpanded(!expanded)}>
              <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: '#6B8E3D' }}><Check size={13} className="text-white" /></div>
              <span className="text-sm font-bold" style={{ color: '#2C1810' }}>{step.label}</span>
              <span className="text-sm font-bold ml-auto" style={{ color: '#6B8E3D' }}>{fmtNum(parseNum(values[step.key]), step.decimals ?? 1)} {step.unit}</span>
              <ChevronRight size={14} style={{ color: '#6B8E3D', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
              {expanded && fb?.type === 'correct' && (
                <div className="absolute mt-10 ml-8 p-2 rounded-lg text-xs italic text-white z-10" style={{ background: '#6B8E3D', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>{fb.msg}</div>
              )}
            </div>
          );
        }

        return (
          <div key={step.key} className="rounded-2xl p-4 transition-all"
            style={{
              background: isActive ? 'white' : 'rgba(250,250,245,0.6)',
              border: `2px solid ${isActive ? '#5C3A21' : '#e8e0c8'}`,
              opacity: isFuture ? 0.45 : 1,
              boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.08)' : 'none',
              animation: shakeKey === step.key ? 'shake 0.5s' : 'none',
            }}>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
                style={{ background: isActive ? '#FBBF24' : '#e8e0c8', color: '#2C1810' }}>{idx + 1}</div>
              <div className="flex-1">
                <p className="font-bold text-sm" style={{ color: '#2C1810' }}>{step.label}</p>
                <p className="text-xs italic mb-2" style={{ color: '#5C3A21' }}>{step.formula}</p>
                {isActive && !isDone && (
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="text-sm font-mono" style={{ color: '#2C1810' }}>{step.prompt}</span>
                    <input type="text" inputMode="decimal" value={values[step.key]}
                      onChange={(e) => setValues(prev => ({ ...prev, [step.key]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleCheck(idx); }}
                      className="w-24 px-2 py-1 rounded-lg font-mono text-sm"
                      style={{ background: '#FAFAF5', border: '2px solid #5C3A21', color: '#2C1810' }}
                      placeholder="?" autoFocus />
                    <span className="text-sm" style={{ color: '#5C3A21' }}>{step.unit}</span>
                    <button onClick={() => handleCheck(idx)} disabled={values[step.key] === ''}
                      className="px-3 py-1 rounded-lg font-bold italic text-white text-sm hover:brightness-90 active:scale-95 disabled:opacity-40"
                      style={{ background: '#5C3A21', border: '2px solid #2C1810', boxShadow: '0 2px 0 rgba(0,0,0,0.15)' }}>
                      Controleer
                    </button>
                  </div>
                )}
                {fb && fb.type === 'wrong' && (
                  <div className="mt-2 p-2 rounded-lg text-xs italic text-white" style={{ background: '#B84A3D' }}>{fb.msg}</div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DATA PANEL
// ═══════════════════════════════════════════════════════════════

function DataPanel({ measurements, compact = false }) {
  const rows = [
    { label: 'Hogedruk', eff: measurements.highPressureEff, unit: 'bar' },
    { label: 'Lagedruk', eff: measurements.lowPressureEff, unit: 'bar' },
  ];
  const temps = [
    { label: 'Verdampingstemperatuur', value: measurements.T_verdamping },
    { label: 'Condensatietemperatuur', value: measurements.T_condensatie },
    { label: 'Eindcompressietemperatuur', value: measurements.T_eindcompressie },
    { label: 'T voor expansieventiel', value: measurements.T_voor_expansie },
    { label: 'T zuigleiding', value: measurements.T_zuigleiding },
  ];
  return (
    <div className={`bg-white rounded-2xl ${compact ? 'p-3' : 'p-4'}`} style={{ border: '2px solid #2C1810', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
      <h4 className="font-extrabold italic text-sm mb-2" style={{ color: '#2C1810' }}>Meetwaardes</h4>
      <div className="mb-3">
        <p className="text-xs font-bold mb-1" style={{ color: '#5C3A21' }}>Drukken</p>
        {rows.map(r => (
          <div key={r.label} className="grid grid-cols-[1fr_auto] gap-2 text-xs mb-0.5" style={{ color: '#2C1810' }}>
            <span>{r.label}</span>
            <span className="font-mono"><span className="font-bold">{fmtNum(r.eff, 1)}</span> bare</span>
          </div>
        ))}
      </div>
      <div>
        <p className="text-xs font-bold mb-1" style={{ color: '#5C3A21' }}>Temperaturen</p>
        {temps.map(t => (
          <div key={t.label} className="grid grid-cols-[1fr_auto] gap-2 text-xs mb-0.5" style={{ color: '#2C1810' }}>
            <span>{t.label}</span>
            <span className="font-mono font-bold">{t.value > 0 ? '+' : ''}{t.value} °C</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// M2R1 — GUIDED DRAWING
// ═══════════════════════════════════════════════════════════════

function GuidedDrawing({ onComplete, onLoseLife, lives }) {
  const svgRef = useRef(null);
  const [step, setStep] = useState(0);
  const [lines, setLines] = useState({ highP: null, lowP: null });
  const [points, setPoints] = useState({ p1: null, p2: null, p3: null, p4: null });
  const [attempts, setAttempts] = useState([0, 0, 0, 0, 0, 0]);
  const [feedbackText, setFeedbackText] = useState(null);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [finished, setFinished] = useState(false);
  const m = M2_MEASUREMENTS_R12;
  const exp = M2_EXPECTED_R12;
  const MAX_ATTEMPTS = 3;

  const stepDefs = [
    { title: 'Stap 1 — Hogedruklijn intekenen',
      desc: <><span className="font-bold not-italic">Hogedruk</span> is <span className="font-bold not-italic">{fmtNum(m.highPressureEff, 0)} bar</span> effectief.<br/>Teken de hogedruklijn in het diagram.<br/>Let op: werk met absolute drukken!</>,
      hint: 'Denk aan: absolute druk = effectieve druk + 1.',
      check: (click) => Math.abs(click.P - m.highPressureAbs) < 0.35,
      apply: () => setLines(prev => ({ ...prev, highP: m.highPressureAbs })), type: 'line' },
    { title: 'Stap 2 — Lagedruklijn intekenen',
      desc: <><span className="font-bold not-italic">Lagedruk</span> is <span className="font-bold not-italic">{fmtNum(m.lowPressureEff, 1)} bar</span> effectief.<br/>Teken de lagedruklijn in het diagram.</>,
      hint: 'Absolute druk = effectieve druk + 1. Dus 1,5 + 1 = 2,5 bara.',
      check: (click) => Math.abs(click.P - m.lowPressureAbs) < 0.2,
      apply: () => setLines(prev => ({ ...prev, lowP: m.lowPressureAbs })), type: 'line' },
    { title: 'Stap 3 — Punt 1 plaatsen (zuigleiding)',
      desc: <>Temperatuur zuigleiding is <span className="font-bold not-italic">{m.T_zuigleiding} °C</span>.<br/>Plaats punt 1 op het snijpunt van de {m.T_zuigleiding}°C-isotherm met de lagedruklijn.<br/>Tip: in het dampgebied loopt de isotherm niet horizontaal!</>,
      hint: 'Zoek de lagedruklijn en volg die tot de juiste temperatuur. Gebruik de crosshair-readout!',
      check: (click) => Math.abs(click.P - m.lowPressureAbs) < 0.25 && Math.abs(click.h - exp.p1.h) < 15,
      apply: () => setPoints(prev => ({ ...prev, p1: { h: exp.p1.h, P: m.lowPressureAbs } })), type: 'point' },
    { title: 'Stap 4 — Punt 2 plaatsen (uit compressor)',
      desc: <>Eindcompressietemperatuur is <span className="font-bold not-italic">{m.T_eindcompressie} °C</span>.<br/>Plaats punt 2 op het snijpunt van de {m.T_eindcompressie}°C-isotherm met de hogedruklijn.</>,
      hint: 'Volg de hogedruklijn tot de juiste temperatuur. Gebruik de readout rechtsboven.',
      check: (click) => Math.abs(click.P - m.highPressureAbs) < 0.35 && Math.abs(click.h - exp.p2.h) < 15,
      apply: () => setPoints(prev => ({ ...prev, p2: { h: exp.p2.h, P: m.highPressureAbs } })), type: 'point' },
    { title: 'Stap 5 — Punt 3 plaatsen (voor expansieventiel)',
      desc: <>Temperatuur voor het expansieventiel is <span className="font-bold not-italic">{m.T_voor_expansie} °C</span>.<br/>Plaats punt 3 op de hogedruklijn bij deze temperatuur.<br/>Tip: in het vloeistofgebied lopen isothermen verticaal!</>,
      hint: 'Hogedruklijn, maar nu links van de vloeistoflijn!',
      check: (click) => Math.abs(click.P - m.highPressureAbs) < 0.35 && Math.abs(click.h - exp.p3.h) < 12,
      apply: () => setPoints(prev => ({ ...prev, p3: { h: exp.p3.h, P: m.highPressureAbs } })), type: 'point' },
    { title: 'Stap 6 — Punt 4 plaatsen (na expansie)',
      desc: <>Het expansieventiel is <span className="font-bold not-italic">isenthalp</span>.<br/>Plaats punt 4 recht onder punt 3, op de lagedruklijn.</>,
      hint: 'h4 = h3. Recht onder punt 3, op de lagedruklijn.',
      check: (click) => Math.abs(click.P - m.lowPressureAbs) < 0.25 && Math.abs(click.h - exp.p3.h) < 15,
      apply: () => setPoints(prev => ({ ...prev, p4: { h: exp.p3.h, P: m.lowPressureAbs } })), type: 'point' },
  ];

  const currentStep = stepDefs[step];

  const handleDiagramClick = (click) => {
    if (finished || !currentStep) return;
    const isCorrect = currentStep.check(click);
    const newAtt = [...attempts]; newAtt[step]++;
    setAttempts(newAtt);
    if (isCorrect) {
      currentStep.apply();
      setPointsEarned(p => p + (newAtt[step] <= MAX_ATTEMPTS ? SCORING.m2r1.perStep : 0));
      setFeedbackText({ type: 'correct', text: `Goed! ${currentStep.title.split('—')[1]?.trim()} geplaatst.` });
      setTimeout(() => { setFeedbackText(null); if (step < stepDefs.length - 1) setStep(step + 1); else setFinished(true); }, 900);
    } else {
      onLoseLife?.();
      if (newAtt[step] >= MAX_ATTEMPTS) {
        currentStep.apply();
        setFeedbackText({ type: 'autocomplete', text: `Geen punten voor deze stap. We plaatsen het correcte ${currentStep.type} voor je.` });
        setTimeout(() => { setFeedbackText(null); if (step < stepDefs.length - 1) setStep(step + 1); else setFinished(true); }, 1500);
      } else {
        setFeedbackText({ type: 'wrong', text: currentStep.hint });
        setTimeout(() => setFeedbackText(null), 2500);
      }
    }
  };

  return (
    <div className="min-h-screen p-4" style={{ background: '#F5EDD6' }}>
      <div className="max-w-6xl mx-auto" style={{ animation: 'fadeInUp 0.4s ease-out' }}>
        <div className="bg-white rounded-2xl p-5 mb-3" style={{ border: '2px solid #2C1810', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          <div className="flex items-start gap-3 mb-3">
            <div><h3 className="text-lg font-extrabold mb-1" style={{ color: '#2C1810' }}>Ronde 2.1 — Begeleid intekenen</h3>
              <p className="text-xs italic" style={{ color: '#5C3A21' }}>Volg de stappen en klik in het diagram op de juiste plek. De crosshair toont T, P, en h.</p></div>
            <div className="ml-auto text-right flex-shrink-0">
              <span className="text-xs font-bold" style={{ color: '#5C3A21' }}>Stap {Math.min(step + 1, stepDefs.length)} / {stepDefs.length}</span>
              <div className="flex gap-1 mt-1">{stepDefs.map((_, i) => (<div key={i} className="w-5 h-2 rounded-full" style={{ background: i < step ? '#6B8E3D' : (i === step ? '#FBBF24' : '#e8e0c8') }} />))}</div>
            </div>
          </div>
          <div className="grid lg:grid-cols-[1fr_280px] gap-4">
            <R134aDiagram svgRef={svgRef} lines={lines} points={points} onDiagramClick={finished ? undefined : handleDiagramClick} activeTool={finished ? null : 'click'} showCrosshair={!finished} />
            <div className="space-y-3">
              {currentStep && !finished && (
                <div className="rounded-xl p-3" style={{ background: 'rgba(251,191,36,0.1)', border: '2px solid #FBBF24' }}>
                  <p className="font-bold text-sm mb-1" style={{ color: '#2C1810' }}>{currentStep.title}</p>
                  <p className="text-xs italic" style={{ color: '#5C3A21', lineHeight: 1.5 }}>{currentStep.desc}</p>
                  <p className="text-xs mt-2" style={{ color: '#5C3A21' }}>Pogingen: {attempts[step]} / {MAX_ATTEMPTS}</p>
                </div>
              )}
            </div>
          </div>
          {feedbackText && (
            <div className="mt-3 p-3 rounded-xl text-sm italic text-white" style={{ background: feedbackText.type === 'correct' ? '#6B8E3D' : feedbackText.type === 'autocomplete' ? '#8B7355' : '#B84A3D', animation: 'fadeInUp 0.2s' }}>
              {feedbackText.text}
            </div>
          )}
          {finished && (
            <div className="mt-4 p-4 rounded-xl" style={{ background: 'rgba(107,142,61,0.1)', border: '2px solid #6B8E3D', animation: 'fadeInUp 0.3s' }}>
              <p className="italic mb-3" style={{ color: '#2C1810', lineHeight: 1.6 }}>
                <span className="font-bold">Mooi werk!</span> Je hebt het bootje stap voor stap opgebouwd in een echt R-134a diagram. Onthoud: altijd +1 bar voor de absolute druk, en de isothermen lopen verschillend per gebied!
              </p>
              <button onClick={() => onComplete(pointsEarned)}
                className="w-full py-3 text-white rounded-xl font-bold italic hover:brightness-90 active:scale-95 flex items-center justify-center gap-2"
                style={{ background: '#5C3A21', border: '2px solid #2C1810', boxShadow: '0 3px 0 #3d2615' }}>
                Volgende <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// M2R2 & M2R3 — FREE DRAWING
// ═══════════════════════════════════════════════════════════════

const TOOL_DEFS = [
  { id: 'highP', label: 'Hogedruklijn', color: '#991B1B' },
  { id: 'lowP', label: 'Lagedruklijn', color: '#1E3A8A' },
  { id: 'p1', label: 'Punt 1, T_zuigleiding', color: '#2C1810' },
  { id: 'p2', label: 'Punt 2, T_eindcompressie', color: '#2C1810' },
  { id: 'p3', label: 'Punt 3, T_expansieventiel', color: '#2C1810' },
];

function FreeDrawing({ measurements, expected, mode, onComplete, onLoseLife, lives }) {
  const svgRef = useRef(null);
  const [lines, setLines] = useState({ highP: null, lowP: null });
  const [points, setPoints] = useState({ p1: null, p2: null, p3: null, p4: null });
  const [feedbackText, setFeedbackText] = useState(null);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [bootjeValidated, setBootjeValidated] = useState(false);
  const [validatedHKeys, setValidatedHKeys] = useState(new Set());

  // Drag state voor tools/elementen
  const [dragState, setDragState] = useState(null);
  // Drag state voor gele h-blokken: { hKey: 'h1'|'h2'|'h3', value: number, screenPos: {x,y} }
  const [hDragState, setHDragState] = useState(null);
  // Welke h-blokken zijn al "gebruikt" (in drop zones geplaatst)
  const [hDropFilled, setHDropFilled] = useState({}); // { [slotId]: hKey }
  // Welke ovh/onk-stap is actief in M2R3 (voor diagram-overlay)
  const [ovhOnkStep, setOvhOnkStep] = useState(null);    // 'ovh' | 'onk' | null
  const [ovhOnkDone, setOvhOnkDone] = useState({});      // { ovh: true, onk: true }

  useEffect(() => {
    if (points.p3 && lines.lowP && !points.p4) setPoints(prev => ({ ...prev, p4: { h: prev.p3.h, P: lines.lowP } }));
    if (!points.p3 && points.p4) setPoints(prev => ({ ...prev, p4: null }));
    // Also update p4 if lowP or p3.h changes (follows p3)
    if (points.p3 && lines.lowP && points.p4 && (points.p4.h !== points.p3.h || points.p4.P !== lines.lowP)) {
      setPoints(prev => ({ ...prev, p4: { h: prev.p3.h, P: lines.lowP } }));
    }
  }, [points.p3, lines.lowP, points.p4]);

  // Global pointer handlers for drag-in-progress
  useEffect(() => {
    if (!dragState || bootjeValidated) return;
    const onMove = (e) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * SVG_W;
      const y = ((e.clientY - rect.top) / rect.height) * SVG_H;
      const inBounds = x >= PLOT.left && x <= PLOT.right && y >= PLOT.top && y <= PLOT.bottom;
      const coords = inBounds ? { h: xToEnthalpy(x), P: yToPressure(y), T: lookupTemp(xToEnthalpy(x), yToPressure(y)) } : null;
      setDragState(ds => {
        if (!ds) return null;
        const dx = ds.startPos ? e.clientX - ds.startPos.x : 0;
        const dy = ds.startPos ? e.clientY - ds.startPos.y : 0;
        const moved = ds.moved || Math.hypot(dx, dy) > 5;
        return { ...ds, screenPos: { x: e.clientX, y: e.clientY }, coords, moved };
      });

      // Live reposition: update position while dragging existing element
      if (dragState.mode === 'reposition' && coords) {
        const t = dragState.target;
        if (t === 'highP') setLines(l => ({ ...l, highP: coords.P }));
        else if (t === 'lowP') setLines(l => ({ ...l, lowP: coords.P }));
        else if (['p1', 'p2', 'p3'].includes(t)) setPoints(p => ({ ...p, [t]: { h: coords.h, P: coords.P } }));
      }
    };
    const onUp = () => {
      setDragState(ds => {
        if (!ds) return null;
        // Commit placement (reposition is already committed via onMove)
        if (ds.mode === 'place' && ds.coords) {
          const t = ds.target;
          if (t === 'highP') setLines(l => ({ ...l, highP: ds.coords.P }));
          else if (t === 'lowP') setLines(l => ({ ...l, lowP: ds.coords.P }));
          else if (['p1', 'p2', 'p3'].includes(t)) setPoints(p => ({ ...p, [t]: { h: ds.coords.h, P: ds.coords.P } }));
        } else if (ds.mode === 'place' && !ds.moved) {
          // Click zonder slepen → plaats direct op verwachte positie
          const t = ds.target;
          if (t === 'highP') setLines(l => ({ ...l, highP: measurements.highPressureAbs }));
          else if (t === 'lowP') setLines(l => ({ ...l, lowP: measurements.lowPressureAbs }));
          else if (t === 'p1') setPoints(p => ({ ...p, p1: { h: expected.p1.h, P: measurements.lowPressureAbs } }));
          else if (t === 'p2') setPoints(p => ({ ...p, p2: { h: expected.p2.h, P: measurements.highPressureAbs } }));
          else if (t === 'p3') setPoints(p => ({ ...p, p3: { h: expected.p3.h, P: measurements.highPressureAbs } }));
        }
        return null;
      });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, [dragState, bootjeValidated]);

  const handleToolPointerDown = (e, toolId) => {
    if (bootjeValidated) return;
    e.preventDefault();
    setDragState({ mode: 'place', target: toolId, screenPos: { x: e.clientX, y: e.clientY }, startPos: { x: e.clientX, y: e.clientY }, coords: null, moved: false });
  };


  const handleElementPointerDown = (target, e) => {
    if (bootjeValidated) return;
    setDragState({ mode: 'reposition', target, screenPos: { x: e.clientX, y: e.clientY }, coords: null });
  };

  // H-block drag (na bootje validatie)
  const handleHBlockPointerDown = (e, hKey, value) => {
    if (!bootjeValidated) return;
    e.preventDefault();
    e.stopPropagation();
    setHDragState({ hKey, value, screenPos: { x: e.clientX, y: e.clientY } });
  };

  // Global pointer handlers voor h-block drag
  useEffect(() => {
    if (!hDragState) return;
    const onMove = (e) => {
      setHDragState(hs => hs ? { ...hs, screenPos: { x: e.clientX, y: e.clientY } } : null);
    };
    const onUp = (e) => {
      // Detect drop target via elementsFromPoint
      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      const dropEl = elements.find(el => el.dataset && el.dataset.hDropSlot);
      if (dropEl && hDragState) {
        const slotId = dropEl.dataset.hDropSlot;
        const expectedKey = dropEl.dataset.hDropExpected;
        if (expectedKey === hDragState.hKey) {
          // Correct drop
          setHDropFilled(prev => ({ ...prev, [slotId]: { hKey: hDragState.hKey, value: hDragState.value, status: 'correct' } }));
        } else {
          // Wrong drop - brief red flash
          setHDropFilled(prev => ({ ...prev, [slotId]: { hKey: hDragState.hKey, value: hDragState.value, status: 'wrong' } }));
          onLoseLife?.();
          setTimeout(() => {
            setHDropFilled(prev => {
              const copy = { ...prev };
              if (copy[slotId]?.status === 'wrong') delete copy[slotId];
              return copy;
            });
          }, 900);
        }
      }
      setHDragState(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, [hDragState, onLoseLife]);

  const handleWissen = (what) => {
    if (bootjeValidated) return;
    if (what === 'all') { setLines({ highP: null, lowP: null }); setPoints({ p1: null, p2: null, p3: null, p4: null }); }
    else if (what === 'lines') setLines({ highP: null, lowP: null });
    else if (['p1', 'p2', 'p3'].includes(what)) setPoints(prev => ({ ...prev, [what]: null, ...(what === 'p3' ? { p4: null } : {}) }));
  };

  const isComplete = lines.highP && lines.lowP && points.p1 && points.p2 && points.p3 && points.p4;

  const validateBootje = () => {
    if (!isComplete) return { valid: false, issues: ['Het bootje is nog niet compleet.'] };
    const issues = [];
    if (Math.abs(lines.highP - measurements.highPressureAbs) > 0.5) issues.push(`Hogedruklijn klopt niet (moet ${fmtNum(measurements.highPressureAbs, 1)} bara zijn).`);
    if (Math.abs(lines.lowP - measurements.lowPressureAbs) > 0.3) issues.push(`Lagedruklijn klopt niet (moet ${fmtNum(measurements.lowPressureAbs, 1)} bara zijn).`);
    if (Math.abs(points.p1.P - measurements.lowPressureAbs) > 0.3 || Math.abs(points.p1.h - expected.p1.h) > 18) issues.push('Punt 1 klopt niet.');
    if (Math.abs(points.p2.P - measurements.highPressureAbs) > 0.5 || Math.abs(points.p2.h - expected.p2.h) > 18) issues.push('Punt 2 klopt niet.');
    if (Math.abs(points.p3.P - measurements.highPressureAbs) > 0.5 || Math.abs(points.p3.h - expected.p3.h) > 15) issues.push('Punt 3 klopt niet.');
    return { valid: issues.length === 0, issues };
  };

  const handleValidate = () => {
    const v = validateBootje();
    if (v.valid) {
      setBootjeValidated(true);
      setPointsEarned(p => p + (mode === 'r2' ? SCORING.m2r2.bootje : SCORING.m2r3.bootje));
      setFeedbackText({ type: 'correct', text: 'Bootje correct getekend! Nu verder met de berekening.' });
    } else {
      onLoseLife?.();
      setFeedbackText({ type: 'wrong', text: v.issues.join(' ') });
    }
    setTimeout(() => setFeedbackText(null), 2500);
  };

  const derived = mode === 'r2' ? deriveEfficiencies(expected) : null;

  // Render drag preview overlay
  const renderDragPreview = () => {
    if (!dragState) return null;
    const toolDef = TOOL_DEFS.find(t => t.id === dragState.target);
    const label = toolDef ? toolDef.label : dragState.target;
    const coords = dragState.coords;
    return (
      <div style={{
        position: 'fixed',
        left: dragState.screenPos.x + 14,
        top: dragState.screenPos.y + 14,
        pointerEvents: 'none',
        zIndex: 1000,
        background: 'white',
        border: '2px solid #2C1810',
        borderRadius: 8,
        padding: '6px 10px',
        fontSize: 11,
        fontFamily: 'Nunito',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
      }}>
        <div style={{ fontWeight: 800, color: toolDef?.color || '#2C1810', marginBottom: 2 }}>
          {dragState.mode === 'reposition' ? 'Verplaats: ' : ''}{label}
        </div>
        {coords ? (
          <div style={{ color: '#5C3A21', fontFamily: 'monospace' }}>
            <div>T: <b>{fmtNum(coords.T, 0)} °C</b></div>
            <div>P: <b>{fmtNum(coords.P, 1)} bar</b></div>
            <div>h: <b>{fmtNum(coords.h, 0)} kJ/kg</b></div>
          </div>
        ) : (
          <div style={{ color: '#8B7355', fontStyle: 'italic' }}>Sleep over het diagram</div>
        )}
      </div>
    );
  };

  // Preview voor h-block drag
  const renderHDragPreview = () => {
    if (!hDragState) return null;
    return (
      <div style={{
        position: 'fixed',
        left: hDragState.screenPos.x - 32,
        top: hDragState.screenPos.y - 12,
        pointerEvents: 'none',
        zIndex: 1000,
        background: '#FBBF24',
        border: '2px solid #2C1810',
        borderRadius: 5,
        padding: '2px 8px',
        fontFamily: 'Nunito',
        fontSize: 11,
        fontWeight: 800,
        color: '#2C1810',
        boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
        textAlign: 'center',
        minWidth: 64,
      }}>
        <div style={{ fontSize: 9, fontWeight: 700 }}>{hDragState.hKey}</div>
        <div>{hDragState.value}</div>
      </div>
    );
  };

  return (
    <div className="min-h-screen p-4" style={{ background: '#F5EDD6' }}>
      {renderDragPreview()}
      {renderHDragPreview()}
      <div className="max-w-7xl mx-auto" style={{ animation: 'fadeInUp 0.4s ease-out' }}>
        <div className="bg-white rounded-2xl p-5 mb-3" style={{ border: '2px solid #2C1810', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          <h3 className="text-lg font-extrabold mb-1" style={{ color: '#2C1810' }}>
            {mode === 'r2' ? 'Ronde 2.2 — Zelfstandig intekenen + EER/COP' : 'Ronde 2.3 — Oververhitting & onderkoeling'}
          </h3>
          <p className="text-sm italic mb-4" style={{ color: '#5C3A21' }}>
            {mode === 'r2'
              ? 'Je kent de aanpak nu. Hier staan alle gegevens. Sleep de lijnen en punten uit het tekenmateriaal op de grafiek. Je kunt ze daarna slepen om ze te corrigeren.'
              : 'Andere installatie, andere gegevens. Sleep de lijnen en punten uit het tekenmateriaal op de grafiek. Je kunt ze altijd nog corrigeren door ze te verslepen.'}
          </p>

          <div className="grid lg:grid-cols-[220px_1fr_240px] gap-3">
            <DataPanel measurements={measurements} compact />
            <div>
              <R134aDiagram
                svgRef={svgRef}
                lines={lines}
                points={points}
                onElementPointerDown={handleElementPointerDown}
                draggableElements={!bootjeValidated}
                activeTool={dragState ? 'drag' : null}
                showCrosshair={!dragState}
              >
                {[{ key: 'h1', point: points.p1, color: '#FBBF24' }, { key: 'h2', point: points.p2, color: '#FBBF24' }, { key: 'h3', point: points.p3, color: '#FBBF24' }].map(({ key, point, color }) => {
                  if (!validatedHKeys.has(key) || !point) return null;
                  const x = enthalpyToX(point.h);
                  const isDraggable = bootjeValidated;
                  const value = Math.round(point.h);
                  return (
                    <g key={`hguide-${key}`} style={{ animation: 'fadeInUp 0.3s', cursor: isDraggable ? 'grab' : 'default' }}
                       onPointerDown={isDraggable ? (e) => handleHBlockPointerDown(e, key, value) : undefined}>
                      <line x1={x} y1={pressureToY(point.P)} x2={x} y2={PLOT.bottom} stroke={color} strokeWidth="2" strokeDasharray="5 3" pointerEvents="none" />
                      <rect x={x - 32} y={PLOT.bottom + 2} width="64" height="22" rx="5" fill={color} stroke={isDraggable ? '#2C1810' : 'none'} strokeWidth={isDraggable ? 1.5 : 0} />
                      <text x={x} y={PLOT.bottom + 12} textAnchor="middle" fontSize="9" fontWeight="700" fill="#2C1810" fontFamily="Nunito" pointerEvents="none">{key}</text>
                      <text x={x} y={PLOT.bottom + 21} textAnchor="middle" fontSize="10" fontWeight="800" fill="#2C1810" fontFamily="Nunito" pointerEvents="none">{value}</text>
                    </g>
                  );
                })}
                {mode === 'r3' && bootjeValidated && (
                  <OvhOnkOverlay
                    measurements={measurements}
                    expected={expected}
                    points={points}
                    activeStep={ovhOnkStep}
                    doneSteps={ovhOnkDone}
                  />
                )}
              </R134aDiagram>
            </div>
            <div className="space-y-2">
              <div className="bg-white rounded-xl p-3" style={{ border: '2px solid #2C1810' }}>
                <p className="text-xs font-bold mb-2" style={{ color: '#5C3A21' }}>Tekenmateriaal</p>
                <p className="text-xs italic mb-2" style={{ color: '#8B7355' }}>Klik om direct te plaatsen, of sleep naar de juiste plek</p>
                {TOOL_DEFS.map(tool => {
                  const isPlaced = (tool.id === 'highP' && lines.highP) || (tool.id === 'lowP' && lines.lowP) || (['p1', 'p2', 'p3'].includes(tool.id) && points[tool.id]);
                  const isDragging = dragState?.mode === 'place' && dragState?.target === tool.id;
                  return (
                    <div key={tool.id}
                      onPointerDown={(e) => !isPlaced && !bootjeValidated && handleToolPointerDown(e, tool.id)}
                      className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-bold mb-1 transition-all select-none"
                      style={{
                        background: isDragging ? '#FBBF24' : (isPlaced ? 'rgba(107,142,61,0.15)' : '#FAFAF5'),
                        color: '#2C1810',
                        border: `2px solid ${isDragging ? '#2C1810' : (isPlaced ? '#6B8E3D' : tool.color)}`,
                        cursor: bootjeValidated || isPlaced ? 'default' : 'grab',
                        opacity: bootjeValidated ? 0.5 : 1,
                        touchAction: 'none',
                      }}>
                      {isPlaced && <Check size={12} className="inline mr-1" style={{ color: '#6B8E3D' }} />}{tool.label}
                    </div>
                  );
                })}
                {points.p4 && (
                  <div className="px-3 py-1.5 rounded-lg text-xs mb-1" style={{ background: 'rgba(124,58,237,0.1)', border: '2px solid #7C3AED', color: '#2C1810' }}>
                    <Check size={12} className="inline mr-1" style={{ color: '#7C3AED' }} />Punt 4 (auto)
                  </div>
                )}
              </div>
              <button onClick={() => handleWissen('all')} disabled={bootjeValidated}
                className="w-full px-3 py-1.5 rounded-lg text-xs font-bold hover:brightness-95 active:scale-95 disabled:opacity-50"
                style={{ background: 'white', color: '#B84A3D', border: '2px solid #B84A3D' }}>
                <Eraser size={12} className="inline mr-1" /> Alles wissen
              </button>
              {!bootjeValidated && isComplete && (
                <button onClick={handleValidate}
                  className="w-full py-2 text-white rounded-xl font-bold italic hover:brightness-90 active:scale-95"
                  style={{ background: '#6B8E3D', border: '2px solid #2C1810', boxShadow: '0 3px 0 rgba(0,0,0,0.2)' }}>
                  Controleer bootje
                </button>
              )}
            </div>
          </div>

          {feedbackText && (
            <div className="mt-3 p-3 rounded-xl text-sm italic text-white" style={{ background: feedbackText.type === 'correct' ? '#6B8E3D' : '#B84A3D', animation: 'fadeInUp 0.2s' }}>
              {feedbackText.text}
            </div>
          )}

          {bootjeValidated && mode === 'r2' && (
            <EerCopCalcPanel
              expected={expected}
              derived={derived}
              onComplete={(pts) => { onComplete(pointsEarned + pts); }}
              onLoseLife={onLoseLife}
              onHValidated={(key) => setValidatedHKeys(prev => new Set([...prev, key]))}
              hDropFilled={hDropFilled}
              hDragActive={!!hDragState}
              onResetSlots={() => setHDropFilled({})}
            />
          )}
          {bootjeValidated && mode === 'r3' && (
            <OvhOnkCalcPanel measurements={measurements} expected={expected}
              onComplete={(pts) => { onComplete(pointsEarned + pts); }}
              onLoseLife={onLoseLife}
              onStepChange={(key) => setOvhOnkStep(key)}
              onStepValidated={(key) => setOvhOnkDone(prev => ({ ...prev, [key]: true }))}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DROP SLOT — target voor drag-and-drop van gele h-blokken
// ═══════════════════════════════════════════════════════════════

function HDropSlot({ slotId, expectedKey, hDropFilled, hDragActive }) {
  const filled = hDropFilled[slotId];
  const isCorrect = filled && filled.status === 'correct';
  const isWrong = filled && filled.status === 'wrong';

  let bg = 'white';
  let border = '2px dashed #8B7355';
  let color = '#8B7355';
  if (isCorrect) { bg = '#FBBF24'; border = '2px solid #2C1810'; color = '#2C1810'; }
  else if (isWrong) { bg = '#B84A3D'; border = '2px solid #2C1810'; color = 'white'; }
  else if (hDragActive) { border = '2px dashed #FBBF24'; bg = 'rgba(251,191,36,0.08)'; }

  return (
    <span
      data-h-drop-slot={slotId}
      data-h-drop-expected={expectedKey}
      style={{
        display: 'inline-block',
        minWidth: 56,
        minHeight: 26,
        padding: '2px 8px',
        borderRadius: 5,
        background: bg,
        border: border,
        color: color,
        fontFamily: 'Nunito',
        fontWeight: 800,
        fontSize: 13,
        textAlign: 'center',
        verticalAlign: 'middle',
        margin: '0 2px',
        transition: 'all 0.15s',
        animation: isWrong ? 'shake 0.5s' : (isCorrect ? 'pop-in 0.3s' : 'none'),
      }}>
      {filled ? filled.value : '?'}
    </span>
  );
}

// Formule-regel met drop slots en resultaat
function DropFormulaStep({ label, slots, template, compute, correct, margin, unit, decimals, hDropFilled, hDragActive, onComplete, stepKey }) {
  const allFilled = slots.every(s => {
    const f = hDropFilled[s.id];
    return f && f.status === 'correct';
  });
  const values = {};
  slots.forEach(s => { if (hDropFilled[s.id]) values[s.id] = hDropFilled[s.id].value; });
  const result = allFilled ? compute(values) : null;
  const isClose = result !== null && Math.abs(result - correct) <= margin;
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (allFilled && isClose && !completed) {
      setCompleted(true);
      onComplete?.(stepKey);
    }
  }, [allFilled, isClose, completed]);

  return (
    <div className="rounded-xl p-3 mb-2" style={{ background: completed ? 'rgba(107,142,61,0.08)' : 'white', border: `2px solid ${completed ? '#6B8E3D' : '#5C3A21'}` }}>
      <div className="flex items-center gap-2 mb-2">
        {completed && <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: '#6B8E3D' }}><Check size={11} className="text-white" /></div>}
        <span className="font-bold text-sm" style={{ color: '#2C1810' }}>{label}</span>
      </div>
      <div className="text-sm" style={{ color: '#2C1810', lineHeight: '2em' }}>
        {template.map((part, i) => {
          if (typeof part === 'string') return <span key={i}>{part}</span>;
          // part is { slot: id, expected: hKey }
          return <HDropSlot key={i} slotId={part.slot} expectedKey={part.expected} hDropFilled={hDropFilled} hDragActive={hDragActive} />;
        })}
        {allFilled && (
          <span className="ml-2 font-bold" style={{ color: completed ? '#6B8E3D' : '#5C3A21' }}>
            = {fmtNum(result, decimals)} {unit}
          </span>
        )}
      </div>
    </div>
  );
}

// EER+COP calc panel for M2R2
function EerCopCalcPanel({ expected, derived, onComplete, onLoseLife, onHValidated, hDropFilled, hDragActive, onResetSlots }) {
  const [done, setDone] = useState(false);
  const [stepPts, setStepPts] = useState(0);
  const [phase, setPhase] = useState('aflezen');
  const [aflezenPts, setAflezenPts] = useState(0);
  const [dropCompleted, setDropCompleted] = useState({}); // { dhComp: true, eer: true }
  const [copValue, setCopValue] = useState('');
  const [copAttempts, setCopAttempts] = useState(0);
  const [copValidated, setCopValidated] = useState(false);

  const aflezenSteps = [
    { key: 'h1', label: 'h1 aflezen', formula: 'h1 (uit diagram)', prompt: 'h1 ≈', correct: derived.h1, margin: 12, decimals: 0, unit: 'kJ/kg', hint: 'Beweeg de crosshair naar punt 1 en lees de enthalpie af.' },
    { key: 'h2', label: 'h2 aflezen', formula: 'h2 (uit diagram)', prompt: 'h2 ≈', correct: derived.h2, margin: 12, decimals: 0, unit: 'kJ/kg', hint: 'Beweeg de crosshair naar punt 2 en lees de enthalpie af.' },
    { key: 'h3', label: 'h3 aflezen', formula: 'h3 (uit diagram)', prompt: 'h3 ≈', correct: derived.h3, margin: 12, decimals: 0, unit: 'kJ/kg', hint: 'Beweeg de crosshair naar punt 3 en lees de enthalpie af.' },
  ];

  const handleAflezenValidated = (key) => { if (['h1', 'h2', 'h3'].includes(key)) onHValidated?.(key); };
  const handleAflezenDone = (values, attempts) => {
    let pts = 0; ['h1', 'h2', 'h3'].forEach(k => { if (attempts[k] === 1) pts += SCORING.m2r2.perH; });
    setAflezenPts(pts); setPhase('eer');
  };

  const handleDropStepComplete = (stepKey) => {
    setDropCompleted(prev => ({ ...prev, [stepKey]: true }));
  };

  const dhCompBothDone = dropCompleted.dhComp && dropCompleted.eer;

  const handleCopCheck = () => {
    const v = parseNum(copValue);
    if (Number.isNaN(v)) return;
    const newAtt = copAttempts + 1;
    setCopAttempts(newAtt);
    if (Math.abs(v - derived.cop) <= 0.4) {
      setCopValidated(true);
      const copPts = newAtt === 1 ? Math.floor(SCORING.m2r2.final / 2) : 0;
      const dropPts = dhCompBothDone ? Math.floor(SCORING.m2r2.final / 2) : 0;
      setStepPts(aflezenPts + dropPts + copPts);
      setDone(true);
    } else {
      onLoseLife?.();
    }
  };

  return (
    <div className="mt-5 space-y-4">
      <div className="p-4 rounded-xl bg-white" style={{ border: '2px solid #2C1810', animation: 'fadeInUp 0.3s' }}>
        <h4 className="font-extrabold italic mb-3" style={{ color: '#2C1810' }}>Enthalpieën aflezen</h4>
        <CalculationPanel steps={aflezenSteps} onAllDone={handleAflezenDone} onLoseLife={onLoseLife} onStepValidated={handleAflezenValidated} />
      </div>

      {(phase === 'eer' || done) && (
        <div className="p-4 rounded-xl bg-white" style={{ border: '2px solid #2C1810', animation: 'fadeInUp 0.3s' }}>
          <h4 className="font-extrabold italic mb-1" style={{ color: '#2C1810' }}>Compressorvermogen & EER</h4>
          <p className="text-xs italic mb-3" style={{ color: '#5C3A21' }}>Sleep de gele h-blokken uit de grafiek in de juiste vakjes.</p>

          <DropFormulaStep
            stepKey="dhComp"
            label="Compressorvermogen"
            slots={[{ id: 'dhComp_a', expected: 'h2' }, { id: 'dhComp_b', expected: 'h1' }]}
            template={[
              { slot: 'dhComp_a', expected: 'h2' },
              ' − ',
              { slot: 'dhComp_b', expected: 'h1' },
            ]}
            compute={(v) => v.dhComp_a - v.dhComp_b}
            correct={derived.dhComp}
            margin={5}
            decimals={0}
            unit="kJ/kg"
            hDropFilled={hDropFilled}
            hDragActive={hDragActive}
            onComplete={handleDropStepComplete}
          />

          <DropFormulaStep
            stepKey="eer"
            label="EER"
            slots={[
              { id: 'eer_a', expected: 'h1' },
              { id: 'eer_b', expected: 'h3' },
              { id: 'eer_c', expected: 'h2' },
              { id: 'eer_d', expected: 'h1' },
            ]}
            template={[
              '( ',
              { slot: 'eer_a', expected: 'h1' },
              ' − ',
              { slot: 'eer_b', expected: 'h3' },
              ' ) / ( ',
              { slot: 'eer_c', expected: 'h2' },
              ' − ',
              { slot: 'eer_d', expected: 'h1' },
              ' )',
            ]}
            compute={(v) => (v.eer_a - v.eer_b) / (v.eer_c - v.eer_d)}
            correct={derived.eer}
            margin={0.4}
            decimals={1}
            unit=""
            hDropFilled={hDropFilled}
            hDragActive={hDragActive}
            onComplete={handleDropStepComplete}
          />

          {!dhCompBothDone && (
            <button onClick={() => onResetSlots?.()}
              className="mt-2 px-3 py-1 rounded-lg text-xs font-bold hover:brightness-95 active:scale-95"
              style={{ background: 'white', color: '#B84A3D', border: '2px solid #B84A3D' }}>
              <Eraser size={10} className="inline mr-1" /> Vakjes legen
            </button>
          )}

          {dhCompBothDone && !done && (
            <div className="mt-3 p-2 rounded-lg text-white text-sm italic" style={{ background: '#6B8E3D', animation: 'fadeInUp 0.3s' }}>
              Goed! EER = {fmtNum(derived.eer, 1)}. Nu de COP berekenen.
            </div>
          )}
        </div>
      )}

      {dhCompBothDone && (
        <div className="p-4 rounded-xl bg-white" style={{ border: '2px solid #2C1810', animation: 'fadeInUp 0.3s' }}>
          <h4 className="font-extrabold italic mb-1" style={{ color: '#2C1810' }}>COP berekenen</h4>
          <p className="text-xs italic mb-3" style={{ color: '#5C3A21' }}>COP = EER + 1</p>
          {!copValidated ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono" style={{ color: '#2C1810' }}>{fmtNum(derived.eer, 1)} + 1 =</span>
              <input
                type="text"
                inputMode="decimal"
                value={copValue}
                onChange={(e) => setCopValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCopCheck(); }}
                className="w-24 px-2 py-1 rounded-lg font-mono text-sm"
                style={{ background: '#FAFAF5', border: '2px solid #5C3A21', color: '#2C1810' }}
                placeholder="?"
                autoFocus
              />
              <button onClick={handleCopCheck} disabled={copValue === ''}
                className="px-3 py-1 rounded-lg font-bold italic text-white text-sm hover:brightness-90 active:scale-95 disabled:opacity-40"
                style={{ background: '#5C3A21', border: '2px solid #2C1810', boxShadow: '0 2px 0 rgba(0,0,0,0.15)' }}>
                Controleer
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(107,142,61,0.08)', border: '1.5px solid #6B8E3D' }}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: '#6B8E3D' }}><Check size={13} className="text-white" /></div>
              <span className="font-bold text-sm" style={{ color: '#2C1810' }}>COP</span>
              <span className="font-bold text-sm ml-auto" style={{ color: '#6B8E3D' }}>{fmtNum(derived.cop, 1)}</span>
            </div>
          )}
        </div>
      )}

      {done && (
        <div className="mt-4 p-3 rounded-xl" style={{ background: 'rgba(107,142,61,0.1)', border: '2px solid #6B8E3D' }}>
          <p className="italic mb-3" style={{ color: '#2C1810', lineHeight: 1.6 }}>
            <span className="font-bold">Knap werk!</span> Deze installatie heeft een EER van ongeveer {fmtNum(derived.eer, 1)} en een COP van {fmtNum(derived.cop, 1)} — een degelijk rendement voor een koel- of warmtepompinstallatie.
          </p>
          <button onClick={() => onComplete(stepPts)}
            className="w-full py-3 text-white rounded-xl font-bold italic hover:brightness-90 active:scale-95 flex items-center justify-center gap-2"
            style={{ background: '#5C3A21', border: '2px solid #2C1810', boxShadow: '0 3px 0 #3d2615' }}>
            Volgende <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// OVH/ONK overlay — visuele ΔT-indicatoren op de drukllijnen in R3
// ═══════════════════════════════════════════════════════════════
function OvhOnkOverlay({ measurements, expected, points, activeStep, doneSteps }) {
  // OVH: sat-damp op lowP (T_verd) tot punt 1 (T_zuig) op de LP-lijn
  const lowP = measurements.lowPressureAbs;
  const highP = measurements.highPressureAbs;
  const satLow = satAtP(lowP);
  const satHigh = satAtP(highP);
  // Ankerpunten
  const ovhStartH = satLow.hV;            // sat-damp bij lowP = T_verdamping
  const ovhEndH = points.p1 ? points.p1.h : expected.p1.h; // T_zuig
  const onkStartH = points.p3 ? points.p3.h : expected.p3.h; // T_voor_expansie
  const onkEndH = satHigh.hL;             // sat-vloeistof bij highP = T_condensatie

  const renderBand = ({ key, show, h1, h2, P, label, valueLabel, color, active, done }) => {
    if (!show) return null;
    const [x1, y] = hpToXY(h1, P);
    const [x2] = hpToXY(h2, P);
    const xMid = (x1 + x2) / 2;
    const bracketY = y - 22;
    const endpointColor = done ? '#6B8E3D' : color;
    return (
      <g key={key} style={{ animation: 'fadeInUp 0.35s ease-out' }}>
        {/* Markers op start en eind */}
        <circle cx={x1} cy={y} r={active ? 6 : 4.5} fill="white" stroke={endpointColor} strokeWidth="2.5">
          {active && <animate attributeName="r" values="4.5;7;4.5" dur="1.4s" repeatCount="indefinite" />}
        </circle>
        <circle cx={x2} cy={y} r={active ? 6 : 4.5} fill="white" stroke={endpointColor} strokeWidth="2.5">
          {active && <animate attributeName="r" values="4.5;7;4.5" dur="1.4s" repeatCount="indefinite" />}
        </circle>
        {/* Dikke band tussen start en eind */}
        <line x1={x1} y1={y} x2={x2} y2={y} stroke={endpointColor} strokeWidth={active ? 5 : 3.5} opacity={active ? 0.85 : 0.55} strokeLinecap="round" />
        {/* Bracket/haakje erboven */}
        <line x1={x1} y1={y - 4} x2={x1} y2={bracketY} stroke={endpointColor} strokeWidth="1.5" />
        <line x1={x2} y1={y - 4} x2={x2} y2={bracketY} stroke={endpointColor} strokeWidth="1.5" />
        <line x1={x1} y1={bracketY} x2={x2} y2={bracketY} stroke={endpointColor} strokeWidth="1.5" />
        {/* Label met ΔT */}
        <rect x={xMid - 78} y={bracketY - 18} width="156" height="16" rx="4" fill={endpointColor} />
        <text x={xMid} y={bracketY - 6} textAnchor="middle" fontSize="10" fontWeight="800" fill="white" fontFamily="Nunito">
          {done ? '✓ ' : ''}{label}: {valueLabel}
        </text>
      </g>
    );
  };

  const showOvh = activeStep === 'ovh' || doneSteps.ovh;
  const showOnk = activeStep === 'onk' || doneSteps.onk;

  return (
    <g pointerEvents="none">
      {renderBand({
        key: 'ovh',
        show: showOvh,
        h1: ovhStartH, h2: ovhEndH, P: lowP,
        label: 'ΔT_ovh',
        valueLabel: `${measurements.T_zuigleiding} − ${measurements.T_verdamping} = ${expected.oververhitting} K`,
        color: '#EA580C',
        active: activeStep === 'ovh' && !doneSteps.ovh,
        done: !!doneSteps.ovh,
      })}
      {renderBand({
        key: 'onk',
        show: showOnk,
        h1: onkStartH, h2: onkEndH, P: highP,
        label: 'ΔT_onk',
        valueLabel: `${measurements.T_condensatie} − ${measurements.T_voor_expansie} = ${expected.onderkoeling} K`,
        color: '#1E3A8A',
        active: activeStep === 'onk' && !doneSteps.onk,
        done: !!doneSteps.onk,
      })}
    </g>
  );
}

// OvhOnk calc panel for M2R3
function OvhOnkCalcPanel({ measurements, expected, onComplete, onLoseLife, onStepChange, onStepValidated }) {
  const [done, setDone] = useState(false);
  const [stepPts, setStepPts] = useState(0);
  const steps = [
    { key: 'ovh', label: 'Oververhitting berekenen', formula: 'ΔT_ovh = T_zuig − T_verdamping',
      prompt: `${measurements.T_zuigleiding} − (${measurements.T_verdamping}) =`,
      correct: expected.oververhitting, margin: 1, decimals: 0, unit: 'K',
      hint: `Oververhitting = T_zuig − T_verdamping = ${measurements.T_zuigleiding} − ${measurements.T_verdamping} = ${expected.oververhitting} K.`,
      feedbackCorrect: 'Goed! Oververhitting is het verschil tussen zuigleidingtemperatuur en verdampingstemperatuur.' },
    { key: 'onk', label: 'Onderkoeling berekenen', formula: 'ΔT_onk = T_condensatie − T_voor_expansie',
      prompt: `${measurements.T_condensatie} − ${measurements.T_voor_expansie} =`,
      correct: expected.onderkoeling, margin: 1, decimals: 0, unit: 'K',
      hint: `Onderkoeling = T_condensatie − T_voor_expansie = ${measurements.T_condensatie} − ${measurements.T_voor_expansie} = ${expected.onderkoeling} K.`,
      feedbackCorrect: 'Klopt! Onderkoeling voorkomt flashgas voor het expansieventiel.' },
  ];
  const handleAll = (values, attempts) => {
    let pts = 0;
    if (attempts.ovh === 1) pts += SCORING.m2r3.ovh;
    if (attempts.onk === 1) pts += SCORING.m2r3.onk;
    setStepPts(pts); setDone(true);
  };
  return (
    <div className="mt-5 p-4 rounded-xl bg-white" style={{ border: '2px solid #2C1810', animation: 'fadeInUp 0.3s' }}>
      <h4 className="font-extrabold italic mb-3" style={{ color: '#2C1810' }}>Oververhitting & onderkoeling</h4>
      <CalculationPanel steps={steps} onAllDone={handleAll} onLoseLife={onLoseLife} onStepChange={onStepChange} onStepValidated={onStepValidated} />
      {done && (
        <div className="mt-4 p-3 rounded-xl" style={{ background: 'rgba(107,142,61,0.1)', border: '2px solid #6B8E3D' }}>
          <p className="italic mb-3" style={{ color: '#2C1810', lineHeight: 1.6 }}>
            <span className="font-bold">Top!</span> De oververhitting is {expected.oververhitting} K — dat betekent dat het koudemiddel {expected.oververhitting} graden "extra" wordt opgewarmd na volledige verdamping. De onderkoeling is {expected.onderkoeling} K. Beide zijn belangrijk voor veilige en efficiënte werking.
          </p>
          <button onClick={() => onComplete(stepPts)}
            className="w-full py-3 text-white rounded-xl font-bold italic hover:brightness-90 active:scale-95 flex items-center justify-center gap-2"
            style={{ background: '#5C3A21', border: '2px solid #2C1810', boxShadow: '0 3px 0 #3d2615' }}>
            Naar de finale check <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// START & END SCREENS
// ═══════════════════════════════════════════════════════════════

function StartScreen({ onStart }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8" style={{ background: '#F5EDD6' }}>
      <div className="text-center max-w-md" style={{ animation: 'fadeInUp 0.5s ease-out' }}>
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4" style={{ background: 'rgba(251,191,36,0.2)' }}>
          <Gauge size={40} style={{ color: '#5C3A21' }} />
        </div>
        <h1 className="text-4xl font-extrabold mb-1" style={{ color: '#2C1810' }}>Koelmachine Meten</h1>
        <h2 className="text-xl font-bold italic mb-4" style={{ color: '#5C3A21' }}>Van meting tot diagram</h2>
        <div className="bg-white rounded-2xl p-6 mb-6" style={{ border: '2px solid #2C1810', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          <p className="italic leading-relaxed" style={{ color: '#5C3A21', lineHeight: 1.7 }}>
            Meet drukken en temperaturen op een draaiende koelinstallatie. Gebruik de meetgegevens om het bootje te tekenen in een h-log p diagram. Bereken het rendement, de oververhitting en de onderkoeling.
          </p>
        </div>
        <button onClick={onStart}
          className="px-10 py-4 text-white rounded-2xl font-extrabold italic text-xl hover:brightness-90 active:scale-95 transition-all"
          style={{ background: '#6B8E3D', border: '3px solid #2C1810', boxShadow: '0 4px 0 #4a6b2a' }}>
          Start
        </button>
        <p className="text-xs mt-3" style={{ color: '#5C3A21', opacity: 0.7 }}>Tip: Ctrl+D voor snelmenu</p>
      </div>
    </div>
  );
}

function EndScreen({ score, onRestart }) {
  const maxScore = 116;
  const pct = Math.round((score / maxScore) * 100);
  const stars = pct >= 80 ? 3 : pct >= 60 ? 2 : pct >= 40 ? 1 : 0;
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#F5EDD6' }}>
      <div className="max-w-md text-center" style={{ animation: 'fadeInUp 0.5s ease-out' }}>
        <div className="inline-flex items-center justify-center w-32 h-32 rounded-full mb-4 text-6xl"
          style={{ background: 'linear-gradient(135deg, #FBBF24, #F59E0B)', border: '4px solid #2C1810', boxShadow: '0 8px 24px rgba(251,191,36,0.4)' }}>
          🏆
        </div>
        <h2 className="text-3xl font-extrabold mb-2" style={{ color: '#2C1810' }}>Gefeliciteerd!</h2>
        <div className="bg-white rounded-2xl p-6 mb-4" style={{ border: '2px solid #2C1810', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          <div className="text-4xl mb-2">
            {[1, 2, 3].map(s => <span key={s} className="mx-1" style={{ color: s <= stars ? '#FBBF24' : '#ccc' }}>★</span>)}
          </div>
          <p className="text-2xl font-extrabold mb-1" style={{ color: '#2C1810' }}>{score} punten ({pct}%)</p>
          <p className="text-sm italic" style={{ color: '#5C3A21' }}>
            {stars === 3 ? 'Uitstekend!' : stars === 2 ? 'Goed gedaan!' : stars === 1 ? 'Aardig werk!' : 'Blijf oefenen!'}
          </p>
        </div>
        <div className="rounded-2xl p-5 mb-6 text-left" style={{ background: 'rgba(107,142,61,0.1)', border: '2px solid #6B8E3D' }}>
          <p className="text-sm italic leading-relaxed" style={{ color: '#2C1810' }}>
            Je kunt nu zelf meetgegevens verzamelen aan een koelinstallatie en deze gebruiken om het bootje te tekenen in een h-log p diagram. Je berekent de <span className="font-bold">EER</span>, <span className="font-bold">COP</span>, <span className="font-bold">oververhitting</span> en <span className="font-bold">onderkoeling</span>. Dit zijn de tools waarmee een koeltechnicus in de praktijk werkt!
          </p>
        </div>
        <button onClick={onRestart}
          className="px-10 py-4 text-white rounded-2xl font-extrabold italic text-lg hover:brightness-90 active:scale-95 flex items-center justify-center gap-2 mx-auto"
          style={{ background: '#5C3A21', border: '3px solid #2C1810', boxShadow: '0 4px 0 #3d2615' }}>
          <RotateCcw size={18} /> Opnieuw spelen
        </button>
      </div>
    </div>
  );
}

function GameOverScreen({ score, onRestart }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#F5EDD6' }}>
      <div className="max-w-md text-center" style={{ animation: 'fadeInUp 0.5s ease-out' }}>
        <div className="flex justify-center gap-1 mb-4">
          {[1, 2, 3, 4, 5].map(i => <Heart key={i} className="w-8 h-8" fill="transparent" stroke="#ccc" style={{ opacity: 0.3 }} />)}
        </div>
        <h2 className="text-3xl font-extrabold mb-2" style={{ color: '#B84A3D' }}>Game Over</h2>
        <div className="bg-white rounded-2xl p-6 mb-6" style={{ border: '2px solid #2C1810', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          <p className="italic mb-2" style={{ color: '#5C3A21' }}>Je hebt geen levens meer.</p>
          <p className="text-lg font-bold" style={{ color: '#2C1810' }}>Score: {score}</p>
        </div>
        <button onClick={onRestart}
          className="px-10 py-4 text-white rounded-2xl font-extrabold italic text-lg hover:brightness-90 active:scale-95 flex items-center justify-center gap-2 mx-auto"
          style={{ background: '#5C3A21', border: '3px solid #2C1810', boxShadow: '0 4px 0 #3d2615' }}>
          <RotateCcw size={18} /> Opnieuw proberen
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN GAME
// ═══════════════════════════════════════════════════════════════

export default function KoelmachineGame() {
  const [screen, setScreen] = useState('start');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(5);
  const [quizQuestions, setQuizQuestions] = useState(null);
  const [debugVisible, setDebugVisible] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); setDebugVisible(v => !v); }
      if (e.key === 'Escape' && debugVisible) setDebugVisible(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [debugVisible]);

  useEffect(() => {
    if (screen.endsWith('_check') && ITEMBANKS[screen]) setQuizQuestions(prepareAllQuestions(ITEMBANKS[screen]));
  }, [screen]);

  useEffect(() => {
    const roundScreens = ['m1r1', 'm1r2', 'm2r1', 'm2r2', 'm2r3'];
    if (roundScreens.includes(screen)) setLives(5);
  }, [screen]);

  const goToScreen = (s) => setScreen(s);
  const addScore = (pts) => setScore(prev => prev + pts);
  const loseLife = useCallback(() => {
    setLives(prev => {
      const newLives = Math.max(0, prev - 1);
      if (newLives === 0) setTimeout(() => setScreen('game_over'), 800);
      return newLives;
    });
  }, []);

  const handleRoundComplete = (nextScreen) => (pts) => { addScore(pts); goToScreen(nextScreen); };
  const handleRestart = () => { setScore(0); setLives(5); setQuizQuestions(null); goToScreen('start'); };

  const renderScreen = () => {
    switch (screen) {
      case 'start': return <StartScreen onStart={() => goToScreen('m1_intro')} />;
      case 'm1_intro': return <M1IntroScreen onBegin={() => goToScreen('m1r1')} />;
      case 'm1r1': return <GuidedMeasurement onComplete={handleRoundComplete('m1r1_check')} onLoseLife={loseLife} lives={lives} />;
      case 'm1r1_check': return quizQuestions ? (
        <div className="min-h-screen p-4 pt-16" style={{ background: '#F5EDD6' }}>
          <QuizCheck quizQs={quizQuestions} maxPoints={SCORING.m1r1_check} onComplete={handleRoundComplete('m1r2')} onLoseLife={loseLife} lives={lives} />
        </div>
      ) : null;
      case 'm1r2': return <IndependentMeasurement onComplete={handleRoundComplete('m1r2_check')} onLoseLife={loseLife} lives={lives} />;
      case 'm1r2_check': return quizQuestions ? (
        <div className="min-h-screen p-4 pt-16" style={{ background: '#F5EDD6' }}>
          <QuizCheck quizQs={quizQuestions} maxPoints={SCORING.m1r2_check} onComplete={handleRoundComplete('m2_intro')} onLoseLife={loseLife} lives={lives} />
        </div>
      ) : null;
      case 'm2_intro': return <M2IntroScreen onBegin={() => goToScreen('m2r1')} />;
      case 'm2r1': return <GuidedDrawing onComplete={handleRoundComplete('m2r1_check')} onLoseLife={loseLife} lives={lives} />;
      case 'm2r1_check': return quizQuestions ? (
        <div className="min-h-screen p-4 pt-16" style={{ background: '#F5EDD6' }}>
          <QuizCheck quizQs={quizQuestions} maxPoints={SCORING.m2r1_check} onComplete={handleRoundComplete('m2r2')} onLoseLife={loseLife} lives={lives} />
        </div>
      ) : null;
      case 'm2r2': return <FreeDrawing measurements={M2_MEASUREMENTS_R12} expected={M2_EXPECTED_R12} mode="r2" onComplete={handleRoundComplete('m2r2_check')} onLoseLife={loseLife} lives={lives} />;
      case 'm2r2_check': return quizQuestions ? (
        <div className="min-h-screen p-4 pt-16" style={{ background: '#F5EDD6' }}>
          <QuizCheck quizQs={quizQuestions} maxPoints={SCORING.m2r2_check} onComplete={handleRoundComplete('m2r3')} onLoseLife={loseLife} lives={lives} />
        </div>
      ) : null;
      case 'm2r3': return <FreeDrawing measurements={M2_MEASUREMENTS_R3} expected={M2_EXPECTED_R3} mode="r3" onComplete={handleRoundComplete('m2r3_check')} onLoseLife={loseLife} lives={lives} />;
      case 'm2r3_check': return quizQuestions ? (
        <div className="min-h-screen p-4 pt-16" style={{ background: '#F5EDD6' }}>
          <QuizCheck quizQs={quizQuestions} maxPoints={SCORING.m2r3_check} onComplete={handleRoundComplete('end')} onLoseLife={loseLife} lives={lives} />
        </div>
      ) : null;
      case 'end': return <EndScreen score={score} onRestart={handleRestart} />;
      case 'game_over': return <GameOverScreen score={score} onRestart={handleRestart} />;
      default: return <StartScreen onStart={() => goToScreen('m1_intro')} />;
    }
  };

  const showProgress = screen !== 'start' && screen !== 'end' && screen !== 'game_over';

  return (
    <div className="relative min-h-screen" style={{ background: '#F5EDD6' }}>
      {showProgress && <ProgressBar screen={screen} lives={lives} score={score} />}
      {renderScreen()}
      <DebugNav visible={debugVisible} currentScreen={screen} onNavigate={goToScreen} onClose={() => setDebugVisible(false)} />
    </div>
  );
}
