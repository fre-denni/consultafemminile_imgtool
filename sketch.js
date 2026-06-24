// by SamuelYAN — optimized by Federico Denni
// https://twitter.com/SamuelAnn0924
// https://www.instagram.com/samuel_yan_1990/

// QuadMosaic Generator (Optimized Version) by Federico Denni
// for the Consulta Femminile Website Renewal
// AI tools (Claude, Gemini) have been used to rework the perfomance of the sketch
// https://www.federicodenni.com

var nOff = 5;
var pointDensity;
var overAllTexture;

// ── Stato ───────────────────────────────────────────────────────────────────
let lastState = "";
let textureTimer = null;

// Buffer offscreen per i due livelli di quad
let layerBehind;
let layerFront;

// ── Palette ──────────────────────────────────────────────────────────────────
// Le palette sono ora array diretti di colori: OPC.palette() restituisce
// l'array selezionato, non un indice numerico.
const palettes = [
  ["#70c1b3", "#004BAD", "#50514f", "#FED201", "#247ba0"],
  ["#1b1b1b", "#292929", "#f3f3f3", "#222222", "#FED201"],
  ["#ffffff", "#e4e2d8", "#b39604", "#FED201", "#fbe786"],
  ["#ffffff", "#e2e2ec", "#004BAD", "#0564ff", "#82afff"],
];

// Il colore di sfondo è ora gestito come palette a swatch singolo,
// così l'utente vede i campioni colorati nel pannello OPC.
const bgPalettes = [["#ffffff"], ["#222222"]];

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min);
}

// ── Helper palette ────────────────────────────────────────────────────────────
// OPC.palette() salva come window[name] solo il PRIMO colore dell'array scelto
// (è il comportamento interno di OPC.initVariable → value = options[0]).
// Per recuperare l'array completo bisogna leggere OPC.options[name].value,
// che invece contiene l'array intero aggiornato dal picker.
function getPalette(name) {
  if (OPC && OPC.options && OPC.options[name]) {
    const v = OPC.options[name].value;
    // v può essere già un array (palette multipla) o una stringa (singolo colore)
    return Array.isArray(v) ? v : [v];
  }
  return ["#000000"]; // fallback di sicurezza
}

/** OPC START **/
OPC.title("Controllo");

OPC.slider({
  name: "seed",
  value: getRandomInt(0, 1000),
  min: 0,
  max: 1000,
  step: 1,
  label: "Variazione Random",
});

OPC.slider({
  name: "canvas_Width",
  value: 800,
  min: 200,
  max: 3000,
  step: 10,
  label: "Larghezza (px)",
});

OPC.slider({
  name: "canvas_Height",
  value: 800,
  min: 200,
  max: 3000,
  step: 10,
  label: "Altezza (px)",
});

OPC.slider({
  name: "pattern_Size",
  value: 65,
  min: 20,
  max: 200,
  step: 1,
  label: "Dimensione Pattern",
});

OPC.slider({
  name: "pattern_Density",
  value: 1,
  min: 0.5,
  max: 3,
  step: 0.1,
  label: "Densità Pattern",
  description:
    "Aumenta (es. 2) o diminuisci (es. 0.5) la fittezza della griglia",
});

// ── REWORK: palette OPC native al posto degli slider numerici ────────────────
// Ciascuna variabile contiene direttamente l'array di colori attivo.
// In draw() e buildLayers() si usa palette_Front / palette_Behind / palette_Bg
// senza passare per indici.

OPC.palette({
  name: "palette_Front",
  options: palettes,
  value: palettes[0],
  label: "Colori primo piano",
});

OPC.palette({
  name: "palette_Behind",
  options: palettes,
  value: palettes[1],
  label: "Colori secondo piano",
});

OPC.palette({
  name: "palette_Bg",
  options: bgPalettes,
  value: bgPalettes[1],
  label: "Colore di Sfondo",
  description: "Swatch bianco = sfondo chiaro, nero = sfondo scuro",
});

// ── Fine rework palette ───────────────────────────────────────────────────────

OPC.slider({
  name: "quad_Width",
  value: 3,
  min: 1,
  max: 4,
  step: 0.25,
  label: "Larghezza Geometria",
});

OPC.slider({
  name: "quad_Height",
  value: 1,
  min: 0.25,
  max: 4,
  step: 0.25,
  label: "Altezza Geometria",
});

OPC.slider({
  name: "quad_Slope",
  value: 1,
  min: -3,
  max: 3,
  step: 0.5,
  label: "Inclinazione",
  description: "Direzione in cui puntano i blocchi 3D",
});

OPC.toggle({
  name: "random_Slope",
  value: 0,
  label: "Inclinazione Caotica",
  description: "0 = Uniforme, 1 = Le direzioni diventano casuali e spezzate",
});

OPC.toggle({
  name: "show_Texture",
  value: 1,
  label: "Filtro Carta",
  description: "0 = Disattivato, 1 = Attivato",
});

OPC.slider({
  name: "texture_Density",
  value: 3,
  min: 0.5,
  max: 10,
  step: 0.5,
  label: "Grana Texture",
  description: "Valori bassi grana fine, valori alti grana ampia",
});

OPC.button("save_webp", "Scarica Immagine");
/** OPC END **/

// ── Setup ────────────────────────────────────────────────────────────────────
function setup() {
  setAttributes("willReadFrequently", true);
  createCanvas(canvas_Width, canvas_Height);
  pixelDensity(4);
  // colorMode RGB (default) — le palette usano stringhe hex, HSB le interpreta male
  background(0);
  frameRate(30);
}

// ── Texture noise ─────────────────────────────────────────────────────────────
function makeFilter() {
  if (
    !overAllTexture ||
    overAllTexture.width !== width ||
    overAllTexture.height !== height
  ) {
    if (overAllTexture) overAllTexture.remove();
    overAllTexture = createGraphics(width, height);
    overAllTexture.pixelDensity(1);
  }

  overAllTexture.loadPixels();
  const w = overAllTexture.width;
  const h = overAllTexture.height;
  const px = overAllTexture.pixels;

  const tDensity = typeof texture_Density !== "undefined" ? texture_Density : 3;

  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const idx = (i + j * w) * 4;
      const n = noise(i / tDensity, j / tDensity, (i * j) / 50);
      const alpha = n * random(5, 15) * 2.55;
      px[idx] = 0;
      px[idx + 1] = 0;
      px[idx + 2] = 0;
      px[idx + 3] = alpha;
    }
  }
  overAllTexture.updatePixels();
}

// ── Disegna i layer quad su buffer offscreen ──────────────────────────────────
// REWORK: palette1 e palette2 sono ora gli array di colori hex diretti,
// non più indici numerici. palette_Bg[0] è il colore di sfondo.
function buildLayers(palette1, palette2) {
  const W = width;
  const H = height;

  const pDensity = typeof pattern_Density !== "undefined" ? pattern_Density : 1;

  if (!layerBehind || layerBehind.width !== W || layerBehind.height !== H) {
    if (layerBehind) layerBehind.remove();
    if (layerFront) layerFront.remove();
    layerBehind = createGraphics(W, H);
    layerFront = createGraphics(W, H);
    layerBehind.pixelDensity(1);
    layerFront.pixelDensity(1);
  }

  const lb = layerBehind;
  lb.clear();
  lb.noStroke();
  lb.strokeCap(SQUARE);

  const pd = pointDensity;
  const qx = pd * quad_Width;
  const qy = pd * quad_Height;

  const step = (pd * 2) / pDensity;

  for (let x = -W * 0.1; x < W * 1.1; x += step) {
    for (let y = -H * 0.1; y < H * 1.1; y += step) {
      let py = quad_Slope * pd;
      if (typeof random_Slope !== "undefined" && random_Slope == 1) {
        let r = noise(x * 100, y * 100);
        py = (r > 0.5 ? 1 : -1) * (quad_Slope * pd);
      }

      const num = noise((x + nOff) / 10, y / 10);
      // palette1 è ora l'array diretto: palette_Behind
      const col = palette1[int(random(1, palette1.length))];
      if (num < 0.15) {
        lb.noStroke();
        lb.fill(col);
      } else if (num >= 0.25 && num < 0.35) {
        lb.stroke(col);
        lb.noFill();
        lb.strokeWeight(random());
      } else if (num >= 0.45 && num < 0.7) {
        lb.noStroke();
        lb.fill(col);
      } else {
        lb.noFill();
        lb.stroke(col);
        lb.strokeWeight(random());
      }
      lb.quad(x, y, x, y + qy, x - qx, y + qy - py, x - qx, y - py);
    }
  }

  const lf = layerFront;
  lf.clear();
  lf.noStroke();
  lf.drawingContext.shadowColor = "rgba(0,0,0,0.2)";
  lf.drawingContext.shadowOffsetX = 10;
  lf.drawingContext.shadowOffsetY = 10;
  lf.drawingContext.shadowBlur = 100;

  for (let x = -W * 0.1; x < W * 1.1; x += step) {
    for (let y = -H * 0.1; y < H * 1.1; y += step) {
      let py = quad_Slope * pd;
      if (typeof random_Slope !== "undefined" && random_Slope == 1) {
        let r = noise(x * 100, y * 100);
        py = (r > 0.5 ? 1 : -1) * (quad_Slope * pd);
      }

      const num = noise((x + nOff) / 10, y / 10);
      // palette2 è ora l'array diretto: palette_Front
      const col = palette2[int(random(1, palette2.length))];
      if (num < 0.15) {
        lf.noStroke();
        lf.fill(col);
      } else if (num >= 0.2 && num < 0.35) {
        lf.noStroke();
        lf.fill(col);
      } else if (num >= 0.45 && num < 0.65) {
        lf.noFill();
        lf.stroke(col);
      } else {
        lf.noStroke();
        lf.fill(col);
      }
      lf.quad(x, y, x, y + qy, x + qx, y + qy - py, x + qx, y - py);
    }
  }

  lf.drawingContext.shadowColor = "transparent";
  lf.drawingContext.shadowBlur = 0;
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function draw() {
  const tDensity = typeof texture_Density !== "undefined" ? texture_Density : 3;
  const pDensity = typeof pattern_Density !== "undefined" ? pattern_Density : 1;
  const rSlope = typeof random_Slope !== "undefined" ? random_Slope : 0;

  // Leggiamo le palette via helper che accede a OPC.options (array completo),
  // non alla variabile globale window[name] che contiene solo il primo colore.
  const palette1 = getPalette("palette_Behind");
  const palette2 = getPalette("palette_Front");
  const bgPal = getPalette("palette_Bg");
  const bgColor = bgPal[0];

  const p1key = palette1.join(",");
  const p2key = palette2.join(",");
  const bgKey = bgColor;

  const currentState = `${seed}_${canvas_Width}_${canvas_Height}_${pattern_Size}_${pDensity}_${p1key}_${p2key}_${bgKey}_${quad_Width}_${quad_Height}_${quad_Slope}_${rSlope}_${show_Texture}_${tDensity}`;

  if (currentState === lastState) return;
  lastState = currentState;

  if (width !== canvas_Width || height !== canvas_Height) {
    resizeCanvas(canvas_Width, canvas_Height);
  }

  randomSeed(seed);
  noiseSeed(seed);

  drawingContext.shadowColor = "transparent";
  drawingContext.shadowBlur = 0;
  noStroke();
  fill(bgColor);
  rect(0, 0, width, height);

  pointDensity = pattern_Size;
  buildLayers(palette1, palette2);

  image(layerBehind, 0, 0);
  image(layerFront, 0, 0);

  if (show_Texture == 1) {
    if (
      overAllTexture &&
      overAllTexture.width === width &&
      overAllTexture.height === height
    ) {
      image(overAllTexture, 0, 0);
    }
    scheduleTexture();
  } else {
    if (textureTimer !== null) {
      clearTimeout(textureTimer);
      textureTimer = null;
    }
  }
}

// ── Debounce texture ──────────────────────────────────────────────────────────
function scheduleTexture() {
  if (textureTimer !== null) clearTimeout(textureTimer);
  textureTimer = setTimeout(() => {
    textureTimer = null;

    if (show_Texture == 0) return;

    randomSeed(seed);
    noiseSeed(seed);

    makeFilter();

    drawingContext.shadowColor = "transparent";
    drawingContext.shadowBlur = 0;

    const bgColor = getPalette("palette_Bg")[0];
    noStroke();
    fill(bgColor);
    rect(0, 0, width, height);

    image(layerBehind, 0, 0);
    image(layerFront, 0, 0);

    image(overAllTexture, 0, 0);
  }, 300);
}

// ── Salvataggio ───────────────────────────────────────────────────────────────
function buttonPressed(name) {
  if (name === "save_webp") {
    if (textureTimer !== null) {
      clearTimeout(textureTimer);
      textureTimer = null;
      randomSeed(seed);
      noiseSeed(seed);
      makeFilter();
      image(overAllTexture, 0, 0);
    }
    saveCanvas("img", "webp");
  }
}

function keyTyped() {
  if (key === "s" || key === "S") {
    saveCanvas("img", "png");
  }
}
