// Constants for configuration
const CONFIG = {
  LEAF: {
    SHOW_THRESHOLD: 0.1,
    SIZE: 16,
    SHADOW_ALPHA: 50,
    MAIN_ALPHA: 200
  },
  BRANCH: {
    LENGTH_RANGE: { MIN: 0.65, MAX: 0.75 },
    WIDTH_SCALE: 0.7,
    ANGLE_VARIATION: { MIN: -0.5, MAX: 0.5 },
    CONTROL_POINTS: {
      FIRST: { MIN: 0.2, MAX: 0.4 },
      SECOND: { MIN: 0.6, MAX: 0.8 }
    },
    CURVES_COUNT: 3,
    MIN_DEPTH_FOR_SPLATS: 2,
    WIDTH_DECAY: 0.7
  },
  SPLATTER: {
    COUNT: { MIN: 3, MAX: 6 },
    ALPHA: { MIN: 50, MAX: 150 }
  },
  CANVAS: {
    SCALE: 0.8,
    FRAME_RATE: 60
  },
  GROUND: {
    LINE_SPACING: 20,
    HEIGHT_RATIO: 0.8,
    VARIATION: 5
  },
  GROWTH: {
    SPEED_FACTOR: 0.001,
    CHILD_DELAY: 0.1,
    CHILD_SCALE: 1.2
  },
  WIND: {
    ANGLE_FACTOR: 0.02,
    TIME_SCALE: 0.001,
    BASE_FREQUENCY: 0.5
  }
};

// State management
let controls;
let growthProgress = 0;
let isGrowing = false;
let treeSeed;
let branchParams = [];
let windTime = 0;
let cachedValues = {
  randomness: 0,
  branchAngle: 0,
  maxDepth: 0,
  leafColor: [34, 139, 34],
  inkColor: [0, 0, 0],
  leafChar: '林',
  windStrength: 0,
  windSpeed: 5,
  branchThickness: 12
};

// Helper function to convert hex to RGB
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : [0, 0, 0];
}

// Function to save canvas as image
function saveAsImage() {
  const timestamp = new Date().toISOString().replace(/[:]/g, '-').split('.')[0];
  saveCanvas(`chinese-ink-tree-${timestamp}`, 'png');
}

// Function to calculate wind effect
function calculateWindEffect(depth, time) {
  const windStrength = cachedValues.windStrength * CONFIG.WIND.ANGLE_FACTOR;
  const frequency = CONFIG.WIND.BASE_FREQUENCY * cachedValues.windSpeed;
  const phase = depth * 0.5; // Different phase for each depth level
  return sin(time * frequency + phase) * windStrength * (1 - depth / cachedValues.maxDepth);
}

// Update cached values for performance
function updateCachedValues() {
  cachedValues.randomness = map(parseInt(controls.randomness.value), 0, 10, 0, 1);
  cachedValues.branchAngle = radians(parseInt(controls.branchAngle.value));
  cachedValues.maxDepth = parseInt(controls.depth.value);
  cachedValues.leafColor = hexToRgb(controls.leafColor.value);
  cachedValues.inkColor = hexToRgb(controls.inkColor.value);
  cachedValues.leafChar = controls.leafChar.value;
  cachedValues.windStrength = parseInt(controls.windStrength.value);
  cachedValues.windSpeed = parseInt(controls.windSpeed.value);
  cachedValues.branchThickness = parseInt(controls.branchThickness.value);
}

// Helper function to generate unique branch parameters
function generateBranchParams(depth, randomFactor) {
  if (depth < 0) return null;

  let params = {
    length: random(CONFIG.BRANCH.LENGTH_RANGE.MIN, CONFIG.BRANCH.LENGTH_RANGE.MAX),
    width: CONFIG.BRANCH.WIDTH_SCALE,
    leftAngle: random(CONFIG.BRANCH.ANGLE_VARIATION.MIN, CONFIG.BRANCH.ANGLE_VARIATION.MAX) * randomFactor,
    rightAngle: random(CONFIG.BRANCH.ANGLE_VARIATION.MIN, CONFIG.BRANCH.ANGLE_VARIATION.MAX) * randomFactor,
    curves: Array(CONFIG.BRANCH.CURVES_COUNT).fill().map(() => ({
      endX: random(-1, 1),
      endY: random(-1, 1),
      ctrl1X: random(CONFIG.BRANCH.CONTROL_POINTS.FIRST.MIN, CONFIG.BRANCH.CONTROL_POINTS.FIRST.MAX),
      ctrl1Y: random(-1, 1),
      ctrl2X: random(CONFIG.BRANCH.CONTROL_POINTS.SECOND.MIN, CONFIG.BRANCH.CONTROL_POINTS.SECOND.MAX),
      ctrl2Y: random(-1, 1),
      alpha: random(100, 255)
    })),
    splats: depth > CONFIG.BRANCH.MIN_DEPTH_FOR_SPLATS
      ? Array(floor(random(CONFIG.SPLATTER.COUNT.MIN, CONFIG.SPLATTER.COUNT.MAX)))
          .fill()
          .map(() => ({
            x: random(0, 1),
            y: random(-1, 1),
            alpha: random(CONFIG.SPLATTER.ALPHA.MIN, CONFIG.SPLATTER.ALPHA.MAX)
          }))
      : []
  };
  return params;
}

// Function to pre-calculate all branch parameters
function calculateTreeParameters() {
  randomSeed(treeSeed);
  branchParams = [];
  updateCachedValues();

  // Calculate parameters for each depth level
  for (let depth = 0; depth <= cachedValues.maxDepth; depth++) {
    branchParams[depth] = [];
    // Pre-calculate more branches than needed to account for different depths
    const branchesAtDepth = pow(2, depth + 2);
    for (let i = 0; i < branchesAtDepth; i++) {
      branchParams[depth].push(generateBranchParams(depth, cachedValues.randomness));
    }
  }
}

function setup() {
  createCanvas(windowWidth * CONFIG.CANVAS.SCALE, windowHeight * CONFIG.CANVAS.SCALE);
  textFont("Noto Sans SC", CONFIG.LEAF.SIZE);
  frameRate(CONFIG.CANVAS.FRAME_RATE);

  // Initialize controls with validation
  controls = {
    depth: document.getElementById("depth"),
    initialLength: document.getElementById("initialLength"),
    branchAngle: document.getElementById("branchAngle"),
    branchThickness: document.getElementById("branchThickness"),
    randomness: document.getElementById("randomness"),
    growthSpeed: document.getElementById("growthSpeed"),
    leafColor: document.getElementById("leafColor"),
    inkColor: document.getElementById("inkColor"),
    leafChar: document.getElementById("leafChar"),
    windStrength: document.getElementById("windStrength"),
    windSpeed: document.getElementById("windSpeed")
  };

  // Validate controls existence
  Object.entries(controls).forEach(([key, element]) => {
    if (!element) {
      console.error(`Control element '${key}' not found!`);
      return;
    }
    
    // Special handling for color inputs and select
    if (key === 'leafColor' || key === 'inkColor' || key === 'leafChar') {
      element.addEventListener("input", () => {
        updateCachedValues();
        redrawTree();
      });
    } else {
      const valueDisplay = document.getElementById(key.replace('Speed', 'Value').replace('Strength', 'Value'));
      if (!valueDisplay) {
        console.error(`Value display for '${key}' not found!`);
        return;
      }
      element.addEventListener("input", () => {
        valueDisplay.textContent = element.value;
        updateCachedValues();
        redrawTree();
      });
    }
  });

  treeSeed = random(10000);
  calculateTreeParameters();
  redrawTree();
}

function windowResized() {
  resizeCanvas(windowWidth * CONFIG.CANVAS.SCALE, windowHeight * CONFIG.CANVAS.SCALE);
  redrawTree();
}

function drawBranch(x, y, len, angle, depth, width, progress, branchIndex = 0) {
  // Scale length and width based on growth progress
  len = len * min(1, progress);
  width = width * min(1, progress);

  // Apply wind effect
  const windAngle = calculateWindEffect(depth, windTime);
  angle += windAngle;

  if (depth === 0 || !branchParams[depth] || branchIndex >= branchParams[depth].length) {
    // Draw character at branch ends with gradual growth
    if (progress > CONFIG.LEAF.SHOW_THRESHOLD) {
      let leafProgress = (progress - CONFIG.LEAF.SHOW_THRESHOLD) * CONFIG.GROWTH.CHILD_SCALE;
      if (leafProgress > 0) {
        push();
        translate(x, y);
        rotate(-angle);
        
        // Calculate size based on growth progress
        let currentSize = CONFIG.LEAF.SIZE * min(1, leafProgress * 2);
        textSize(currentSize);
        textAlign(CENTER, CENTER);

        // Get current leaf color
        const [r, g, b] = cachedValues.leafColor;
        
        // Calculate alpha based on growth progress
        let shadowAlpha = CONFIG.LEAF.SHADOW_ALPHA * leafProgress;
        let mainAlpha = CONFIG.LEAF.MAIN_ALPHA * leafProgress;

        // Apply wind effect to characters
        rotate(windAngle * 0.5); // Reduced effect for leaves

        // Draw shadow for depth effect
        fill(r, g, b, shadowAlpha);
        noStroke();
        text(cachedValues.leafChar, 1, 1);

        // Draw main character
        fill(r, g, b, mainAlpha);
        text(cachedValues.leafChar, 0, 0);
        pop();
      }
    }
    return;
  }

  const params = branchParams[depth][branchIndex];
  push();
  translate(x, y);

  // Calculate base width with inverted depth-based scaling to make branches thinner towards tips
  const baseWidth = cachedValues.branchThickness * pow(CONFIG.BRANCH.WIDTH_DECAY, cachedValues.maxDepth - depth);

  // Add ink texture effect using pre-calculated parameters
  const [inkR, inkG, inkB] = cachedValues.inkColor;
  
  for (let i = 0; i < CONFIG.BRANCH.CURVES_COUNT; i++) {
    const curve = params.curves[i];
    let branchEndX = len * cos(-angle);
    let branchEndY = len * sin(-angle);

    branchEndX += baseWidth * curve.endX;
    branchEndY += baseWidth * curve.endY;

    stroke(inkR, inkG, inkB, curve.alpha);
    strokeWeight(baseWidth * random(0.8, 1.2));

    let ctrl1X = len * curve.ctrl1X;
    let ctrl1Y = baseWidth * curve.ctrl1Y;
    let ctrl2X = len * curve.ctrl2X;
    let ctrl2Y = baseWidth * curve.ctrl2Y;

    noFill();
    bezier(0, 0, ctrl1X, ctrl1Y, ctrl2X, ctrl2Y, branchEndX, branchEndY);
  }

  // Add pre-calculated ink splatter effect
  params.splats.forEach((splat) => {
    stroke(inkR, inkG, inkB, splat.alpha);
    strokeWeight(random(1, 2));
    point(len * splat.x, baseWidth * splat.y);
  });

  // Calculate next branches using pre-calculated parameters
  let newLen = len * params.length;
  let newWidth = baseWidth * params.width;

  // Use pre-calculated angle variations
  let leftAngle = angle + cachedValues.branchAngle + params.leftAngle;
  let rightAngle = angle - cachedValues.branchAngle + params.rightAngle;

  // Recursively draw branches with consistent indices
  if (progress > CONFIG.GROWTH.CHILD_DELAY) {
    translate(len * cos(-angle), len * sin(-angle));
    let nextProgress = (progress - CONFIG.GROWTH.CHILD_DELAY) * CONFIG.GROWTH.CHILD_SCALE;
    if (nextProgress > 0) {
      drawBranch(0, 0, newLen, leftAngle, depth - 1, newWidth, nextProgress, branchIndex * 2);
      drawBranch(0, 0, newLen, rightAngle, depth - 1, newWidth, nextProgress, branchIndex * 2 + 1);
    }
  }

  pop();
}

function draw() {
  // Update wind time
  windTime += CONFIG.WIND.TIME_SCALE * (isGrowing ? 1 : 2);

  if (isGrowing) {
    let growthSpeed = parseInt(controls.growthSpeed.value);
    growthProgress = min(1, growthProgress + CONFIG.GROWTH.SPEED_FACTOR * growthSpeed);
    if (growthProgress >= 1) {
      isGrowing = false;
    }
  }
  
  // Always redraw if wind is active
  if (isGrowing || cachedValues.windStrength > 0) {
    redrawTree();
  }
}

function startGrowth() {
  treeSeed = random(10000);
  calculateTreeParameters();
  isGrowing = true;
  growthProgress = 0;
}

function resetTree() {
  isGrowing = false;
  growthProgress = 0;
  redrawTree();
}

function redrawTree() {
  background(255);

  // Draw ground texture
  const [inkR, inkG, inkB] = cachedValues.inkColor;
  stroke(inkR, inkG, inkB, 30);
  for (let i = 0; i < width; i += CONFIG.GROUND.LINE_SPACING) {
    let y = height * CONFIG.GROUND.HEIGHT_RATIO + random(-CONFIG.GROUND.VARIATION, CONFIG.GROUND.VARIATION);
    strokeWeight(random(0.5, 2));
    line(i, y, i + random(10, 30), y + random(-CONFIG.GROUND.VARIATION, CONFIG.GROUND.VARIATION));
  }

  // Draw main tree
  drawBranch(
    width / 2,
    height * CONFIG.GROUND.HEIGHT_RATIO,
    parseInt(controls.initialLength.value),
    PI / 2,
    cachedValues.maxDepth,
    cachedValues.branchThickness,
    growthProgress
  );
}
