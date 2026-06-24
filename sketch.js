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
var colors;

// ── Stato ───────────────────────────────────────────────────────────────────
let lastState = "";
let textureTimer = null;

// Buffer offscreen per i due livelli di quad
let layerBehind;
let layerFront;
let layersDirty = true;

// Fallback per show_Texture prima che OPC la inizializzi
// var show_Texture = 1;

// ── Palette ──────────────────────────────────────────────────────────────────
const palettes = [
  ["#70c1b3", "#004BAD", "#50514f", "#FED201", "#247ba0"],
  ["#1b1b1b", "#292929", "#f3f3f3", "#222222", "#FED201"],
  ["#ffffff", "#e2e2ec", "#004BAD", "#0564ff", "#82afff"],
];
const palettesbg = ["#ffffff", "#222222"];
let palettebg;

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min);
}

/** OPC START **/
OPC.label("Controllo");
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

OPC.slider({
  name: "Color_Front",
  value: 0,
  min: 0,
  max: palettes.length - 1,
  step: 1,
  label: "Colori primo piano",
});

OPC.slider({
  name: "Color_Behind",
  value: 1,
  min: 0,
  max: palettes.length - 1,
  step: 1,
  label: "Colori secondo piano",
});

OPC.slider({
  name: "Color_Bg",
  value: 1,
  min: 0,
  max: palettesbg.length - 1,
  step: 1,
  label: "Colore di Sfondo",
  description: "0: bianco, 1:nero",
});

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

OPC.slider({
  name: "random_Slope",
  value: 0,
  min: 0,
  max: 1,
  step: 1,
  label: "Inclinazione Caotica",
  description: "0 = Uniforme, 1 = Le direzioni diventano casuali e spezzate",
});

OPC.slider({
  name: "show_Texture",
  value: 1,
  min: 0,
  max: 1,
  step: 1,
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
  colorMode(HSB, 360, 100, 100, 100);
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

  // Sicurezza: leggiamo il valore di OPC (se non è ancora pronto, usiamo 3)
  const tDensity = typeof texture_Density !== "undefined" ? texture_Density : 3;

  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const idx = (i + j * w) * 4;
      // Applichiamo tDensity per scalare il rumore
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
function buildLayers(palette1, palette2) {
  const W = width;
  const H = height;

  // Sicurezza: leggiamo il valore di OPC
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
  //const py = quad_Slope * pd;

  // Se pDensity è 1, il passo è il classico (pd * 2).
  // Se pDensity aumenta (es. 2), il passo si dimezza, creando molti più quad (più densi).
  const step = (pd * 2) / pDensity;

  // Utilizziamo 'step' al posto di 'pd * 2' nel ciclo del layer Behind
  for (let x = -W * 0.1; x < W * 1.1; x += step) {
    for (let y = -H * 0.1; y < H * 1.1; y += step) {
      let py = quad_Slope * pd; // Valore base dello slider
      if (typeof random_Slope !== "undefined" && random_Slope == 1) {
        // Generiamo un "falso random" basato sulle coordinate in modo che i livelli combacino
        let r = noise(x * 100, y * 100);
        // Inverte casualmente la direzione (positivo o negativo) mantenendo l'inclinazione intatta
        py = (r > 0.5 ? 1 : -1) * (quad_Slope * pd);
      }

      const num = noise((x + nOff) / 10, y / 10);
      const col = palette1[int(random(1, 5))];
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

  // Utilizziamo lo stesso 'step' anche per il layer Front
  for (let x = -W * 0.1; x < W * 1.1; x += step) {
    for (let y = -H * 0.1; y < H * 1.1; y += step) {
      let py = quad_Slope * pd;
      if (typeof random_Slope !== "undefined" && random_Slope == 1) {
        let r = noise(x * 100, y * 100);
        py = (r > 0.5 ? 1 : -1) * (quad_Slope * pd);
      }

      const num = noise((x + nOff) / 10, y / 10);
      const col = palette2[int(random(1, 5))];
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
  layersDirty = false;
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function draw() {
  // Sicurezza per i nuovi slider
  const tDensity = typeof texture_Density !== "undefined" ? texture_Density : 3;
  const pDensity = typeof pattern_Density !== "undefined" ? pattern_Density : 1;
  const rSlope = typeof random_Slope !== "undefined" ? random_Slope : 0;

  // Aggiungiamo rSlope alla stringa di controllo
  const currentState = `${seed}_${canvas_Width}_${canvas_Height}_${pattern_Size}_${pDensity}_${Color_Front}_${Color_Behind}_${Color_Bg}_${quad_Width}_${quad_Height}_${quad_Slope}_${rSlope}_${show_Texture}_${tDensity}`;

  if (currentState === lastState) return;
  lastState = currentState;

  if (width !== canvas_Width || height !== canvas_Height) {
    resizeCanvas(canvas_Width, canvas_Height);
  }

  randomSeed(seed);
  noiseSeed(seed);

  const palette1 = palettes[Color_Behind];
  const palette2 = palettes[Color_Front];
  palettebg = palettesbg[Color_Bg];
  pointDensity = pattern_Size;

  drawingContext.shadowColor = "transparent";
  drawingContext.shadowBlur = 0;
  noStroke();
  fill(palettebg);
  rect(0, 0, width, height);

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

    // 1. Calcola la nuova texture con la densità aggiornata
    makeFilter();

    // 2. Prepariamo il canvas principale rimuovendo le ombre
    drawingContext.shadowColor = "transparent";
    drawingContext.shadowBlur = 0;

    // 3. FIX: Ridisegniamo tutto da zero per evitare la "doppia" texture
    noStroke();
    fill(palettebg);
    rect(0, 0, width, height); // Pulisce lo sfondo

    // Ridisegna le geometrie (usiamo i livelli già calcolati, è istantaneo!)
    image(layerBehind, 0, 0);
    image(layerFront, 0, 0);

    // 4. Infine, stampa la nuova texture singola e pulita
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
    saveCanvas("QuadMosaic", "webp");
  }
}

function keyTyped() {
  if (key === "s" || key === "S") {
    saveCanvas("QuadMosaic", "png");
  }
}
