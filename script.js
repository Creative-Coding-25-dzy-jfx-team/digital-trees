// Constants for configuration
const CONFIG = {
  LEAF: {
    SHOW_THRESHOLD: 0.1,
    SIZE: 16,
    SHADOW_ALPHA: 50,
    MAIN_ALPHA: 200,
  },
  BRANCH: {
    LENGTH_RANGE: { MIN: 0.65, MAX: 0.75 },
    WIDTH_SCALE: 0.7,
    ANGLE_VARIATION: { MIN: -0.5, MAX: 0.5 },
    CONTROL_POINTS: {
      FIRST: { MIN: 0.2, MAX: 0.4 },
      SECOND: { MIN: 0.6, MAX: 0.8 },
    },
    CURVES_COUNT: 3,
    MIN_DEPTH_FOR_SPLATS: 2,
    WIDTH_DECAY: 0.7,
  },
  SPLATTER: {
    COUNT: { MIN: 3, MAX: 6 },
    ALPHA: { MIN: 50, MAX: 150 },
  },
  CANVAS: {
    SCALE: 0.8,
    FRAME_RATE: 60,
  },
  GROUND: {
    LINE_SPACING: 20,
    HEIGHT_RATIO: 0.8,
    VARIATION: 20, // Increased ground height variation
  },
  GROWTH: {
    SPEED_FACTOR: 0.001,
    CHILD_DELAY: 0.1,
    CHILD_SCALE: 1.2,
  },
  WIND: {
    ANGLE_FACTOR: 0.02,
    TIME_SCALE: 0.001,
    BASE_FREQUENCY: 0.5,
  },
  TREE: {
    COUNT: { MIN: 5, MAX: 8 }, // Increased tree count for better scene
    SPACING: 200,
    LENGTH_VARIATION: 0.2, // ±20% variation in length
    DEPTH_VARIATION: 2, // ±2 levels variation in depth
    ANGLE_VARIATION: 0.2, // ±20% variation in angle
    Z_RANGE: { MIN: 0.5, MAX: 2.0 }, // z-depth range (0.5=far, 2.0=near)
    HEIGHT_VARIATION: 50, // ±50px variation in base height
  },
};

// State management
let controls;
let windTime = 0;
let trees = [];
let isGrowing = false;
let cachedValues = {
  randomness: 0,
  branchAngle: 0,
  maxDepth: 0,
  leafColor: [34, 139, 34],
  inkColor: [0, 0, 0],
  leafChar: "林",
  windStrength: 0,
  windSpeed: 5,
  branchThickness: 12,
};

class Tree {
  constructor(x, seed) {
    this.x = x;
    this.seed = seed;
    this.growthProgress = 0;
    this.branchParams = [];

    // Initialize depth and height parameters
    randomSeed(this.seed);
    this.z = random(CONFIG.TREE.Z_RANGE.MIN, CONFIG.TREE.Z_RANGE.MAX);
    this.heightOffset = random(
      -CONFIG.TREE.HEIGHT_VARIATION,
      CONFIG.TREE.HEIGHT_VARIATION
    );

    this.params = this.generateTreeParams();
    this.calculateBranchParameters();
  }

  generateTreeParams() {
    randomSeed(this.seed);
    return {
      initialLength:
        parseInt(controls.initialLength.value) *
        (1 +
          random(-CONFIG.TREE.LENGTH_VARIATION, CONFIG.TREE.LENGTH_VARIATION)) *
        this.z,
      maxDepth:
        parseInt(controls.depth.value) +
        floor(
          random(-CONFIG.TREE.DEPTH_VARIATION, CONFIG.TREE.DEPTH_VARIATION)
        ),
      branchAngle:
        radians(parseInt(controls.branchAngle.value)) *
        (1 + random(-CONFIG.TREE.ANGLE_VARIATION, CONFIG.TREE.ANGLE_VARIATION)),
    };
  }

  generateBranchParams(depth, randomFactor) {
    if (depth < 0) return null;

    let params = {
      length: random(
        CONFIG.BRANCH.LENGTH_RANGE.MIN,
        CONFIG.BRANCH.LENGTH_RANGE.MAX
      ),
      width: CONFIG.BRANCH.WIDTH_SCALE,
      leftAngle:
        random(
          CONFIG.BRANCH.ANGLE_VARIATION.MIN,
          CONFIG.BRANCH.ANGLE_VARIATION.MAX
        ) * randomFactor,
      rightAngle:
        random(
          CONFIG.BRANCH.ANGLE_VARIATION.MIN,
          CONFIG.BRANCH.ANGLE_VARIATION.MAX
        ) * randomFactor,
      curves: Array(CONFIG.BRANCH.CURVES_COUNT)
        .fill()
        .map(() => ({
          endX: random(-1, 1),
          endY: random(-1, 1),
          ctrl1X: random(
            CONFIG.BRANCH.CONTROL_POINTS.FIRST.MIN,
            CONFIG.BRANCH.CONTROL_POINTS.FIRST.MAX
          ),
          ctrl1Y: random(-1, 1),
          ctrl2X: random(
            CONFIG.BRANCH.CONTROL_POINTS.SECOND.MIN,
            CONFIG.BRANCH.CONTROL_POINTS.SECOND.MAX
          ),
          ctrl2Y: random(-1, 1),
          alpha: random(100, 255),
        })),
      splats:
        depth > CONFIG.BRANCH.MIN_DEPTH_FOR_SPLATS
          ? Array(
              floor(
                random(CONFIG.SPLATTER.COUNT.MIN, CONFIG.SPLATTER.COUNT.MAX)
              )
            )
              .fill()
              .map(() => ({
                x: random(0, 1),
                y: random(-1, 1),
                alpha: random(
                  CONFIG.SPLATTER.ALPHA.MIN,
                  CONFIG.SPLATTER.ALPHA.MAX
                ),
              }))
          : [],
    };
    return params;
  }

  calculateBranchParameters() {
    randomSeed(this.seed);
    this.branchParams = [];

    // Calculate parameters for each depth level
    for (let depth = 0; depth <= this.params.maxDepth; depth++) {
      this.branchParams[depth] = [];
      // Pre-calculate more branches than needed to account for different depths
      const branchesAtDepth = pow(2, depth + 2);
      for (let i = 0; i < branchesAtDepth; i++) {
        this.branchParams[depth].push(
          this.generateBranchParams(depth, cachedValues.randomness)
        );
      }
    }
  }

  drawBranch(x, y, len, angle, depth, width, progress, branchIndex = 0) {
    // Scale length and width based on growth progress
    len = len * min(1, progress);
    width = width * min(1, progress);

    // Apply wind effect with phase offset based on x position
    const windAngle = calculateWindEffect(depth, windTime + this.x * 0.01);
    angle += windAngle;

    if (
      depth === 0 ||
      !this.branchParams[depth] ||
      branchIndex >= this.branchParams[depth].length
    ) {
      // Draw character at branch ends with gradual growth
      if (progress > CONFIG.LEAF.SHOW_THRESHOLD) {
        let leafProgress =
          (progress - CONFIG.LEAF.SHOW_THRESHOLD) * CONFIG.GROWTH.CHILD_SCALE;
        if (leafProgress > 0) {
          push();
          translate(x, y);
          rotate(-angle);

          // Calculate size based on growth progress and depth
          let currentSize =
            CONFIG.LEAF.SIZE * this.z * min(1, leafProgress * 2);
          textSize(currentSize);
          textAlign(CENTER, CENTER);

          // Get current leaf color with depth-based alpha
          const [r, g, b] = cachedValues.leafColor;

          // Calculate alpha based on growth progress and depth
          let shadowAlpha = CONFIG.LEAF.SHADOW_ALPHA * leafProgress * this.z;
          let mainAlpha = CONFIG.LEAF.MAIN_ALPHA * leafProgress * this.z;

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

    const params = this.branchParams[depth][branchIndex];
    push();
    translate(x, y);

    // Calculate base width with inverted depth-based scaling
    const baseWidth =
      cachedValues.branchThickness *
      this.z *
      pow(CONFIG.BRANCH.WIDTH_DECAY, this.params.maxDepth - depth);

    // Add ink texture effect using pre-calculated parameters with depth-based alpha
    const [inkR, inkG, inkB] = cachedValues.inkColor;

    for (let i = 0; i < CONFIG.BRANCH.CURVES_COUNT; i++) {
      const curve = params.curves[i];
      let branchEndX = len * cos(-angle);
      let branchEndY = len * sin(-angle);

      branchEndX += baseWidth * curve.endX;
      branchEndY += baseWidth * curve.endY;

      stroke(inkR, inkG, inkB, curve.alpha * this.z);
      strokeWeight(baseWidth * random(0.8, 1.2));

      let ctrl1X = len * curve.ctrl1X;
      let ctrl1Y = baseWidth * curve.ctrl1Y;
      let ctrl2X = len * curve.ctrl2X;
      let ctrl2Y = baseWidth * curve.ctrl2Y;

      noFill();
      bezier(0, 0, ctrl1X, ctrl1Y, ctrl2X, ctrl2Y, branchEndX, branchEndY);
    }

    // Add pre-calculated ink splatter effect with depth-based alpha
    params.splats.forEach((splat) => {
      stroke(inkR, inkG, inkB, splat.alpha * this.z);
      strokeWeight(random(1, 2) * this.z);
      point(len * splat.x, baseWidth * splat.y);
    });

    // Calculate next branches using pre-calculated parameters
    let newLen = len * params.length;
    let newWidth = baseWidth * params.width;

    // Use pre-calculated angle variations with tree-specific base angle
    let leftAngle = angle + this.params.branchAngle + params.leftAngle;
    let rightAngle = angle - this.params.branchAngle + params.rightAngle;

    // Recursively draw branches with consistent indices
    if (progress > CONFIG.GROWTH.CHILD_DELAY) {
      translate(len * cos(-angle), len * sin(-angle));
      let nextProgress =
        (progress - CONFIG.GROWTH.CHILD_DELAY) * CONFIG.GROWTH.CHILD_SCALE;
      if (nextProgress > 0) {
        this.drawBranch(
          0,
          0,
          newLen,
          leftAngle,
          depth - 1,
          newWidth,
          nextProgress,
          branchIndex * 2
        );
        this.drawBranch(
          0,
          0,
          newLen,
          rightAngle,
          depth - 1,
          newWidth,
          nextProgress,
          branchIndex * 2 + 1
        );
      }
    }

    pop();
  }

  update() {
    if (isGrowing) {
      let growthSpeed = parseInt(controls.growthSpeed.value);
      this.growthProgress = min(
        1,
        this.growthProgress + CONFIG.GROWTH.SPEED_FACTOR * growthSpeed
      );
    }
  }

  draw() {
    this.drawBranch(
      this.x,
      height * CONFIG.GROUND.HEIGHT_RATIO + this.heightOffset,
      this.params.initialLength,
      PI / 2,
      this.params.maxDepth,
      cachedValues.branchThickness * this.z,
      this.growthProgress
    );
  }
}

// Helper function to convert hex to RGB
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ]
    : [0, 0, 0];
}

// Function to save canvas as image
function saveAsImage() {
  const timestamp = new Date().toISOString().replace(/[:]/g, "-").split(".")[0];
  saveCanvas(`chinese-ink-tree-${timestamp}`, "png");
}

// Function to calculate wind effect
function calculateWindEffect(depth, time) {
  const windStrength = cachedValues.windStrength * CONFIG.WIND.ANGLE_FACTOR;
  const frequency = CONFIG.WIND.BASE_FREQUENCY * cachedValues.windSpeed;
  const phase = depth * 0.5; // Different phase for each depth level
  return (
    sin(time * frequency + phase) *
    windStrength *
    (1 - depth / cachedValues.maxDepth)
  );
}

// Update cached values for performance
function updateCachedValues() {
  cachedValues.randomness = map(
    parseInt(controls.randomness.value),
    0,
    10,
    0,
    1
  );
  cachedValues.branchAngle = radians(parseInt(controls.branchAngle.value));
  cachedValues.maxDepth = parseInt(controls.depth.value);
  cachedValues.leafColor = hexToRgb(controls.leafColor.value);
  cachedValues.inkColor = hexToRgb(controls.inkColor.value);
  cachedValues.leafChar = controls.leafChar.value;
  cachedValues.windStrength = parseInt(controls.windStrength.value);
  cachedValues.windSpeed = parseInt(controls.windSpeed.value);
  cachedValues.branchThickness = parseInt(controls.branchThickness.value);
}

function createTrees() {
  trees = [];
  const count = floor(random(CONFIG.TREE.COUNT.MIN, CONFIG.TREE.COUNT.MAX));
  const spacing = width / (count + 1);

  for (let i = 0; i < count; i++) {
    const x = spacing * (i + 1) + random(-spacing * 0.2, spacing * 0.2);
    const seed = random(10000);
    trees.push(new Tree(x, seed));
  }

  // Sort trees by z-depth (far to near)
  trees.sort((a, b) => a.z - b.z);
}

function setup() {
  createCanvas(
    windowWidth * CONFIG.CANVAS.SCALE,
    windowHeight * CONFIG.CANVAS.SCALE
  );
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
    windSpeed: document.getElementById("windSpeed"),
  };

  // Validate controls existence
  Object.entries(controls).forEach(([key, element]) => {
    if (!element) {
      console.error(`Control element '${key}' not found!`);
      return;
    }

    // Special handling for color inputs and select
    if (key === "leafColor" || key === "inkColor" || key === "leafChar") {
      element.addEventListener("input", () => {
        updateCachedValues();
        redrawTrees();
      });
    } else {
      const valueDisplay = document.getElementById(
        key.replace("Speed", "Value").replace("Strength", "Value")
      );
      if (!valueDisplay) {
        console.error(`Value display for '${key}' not found!`);
        return;
      }
      element.addEventListener("input", () => {
        valueDisplay.textContent = element.value;
        updateCachedValues();
        redrawTrees();
      });
    }
  });

  createTrees();
  redrawTrees();
}

function windowResized() {
  resizeCanvas(
    windowWidth * CONFIG.CANVAS.SCALE,
    windowHeight * CONFIG.CANVAS.SCALE
  );
  createTrees(); // Recreate trees with new spacing for new width
  redrawTrees();
}

function draw() {
  // Update wind time
  windTime += CONFIG.WIND.TIME_SCALE * (isGrowing ? 1 : 2);

  if (isGrowing) {
    let allDoneGrowing = true;
    trees.forEach((tree) => {
      tree.update();
      if (tree.growthProgress < 1) {
        allDoneGrowing = false;
      }
    });
    if (allDoneGrowing) {
      isGrowing = false;
    }
  }

  // Always redraw if growing or wind is active
  if (isGrowing || cachedValues.windStrength > 0) {
    redrawTrees();
  }
}

function startGrowth() {
  createTrees();
  isGrowing = true;
  trees.forEach((tree) => (tree.growthProgress = 0));
}

function resetTrees() {
  isGrowing = false;
  trees.forEach((tree) => (tree.growthProgress = 0));
  redrawTrees();
}

function redrawTrees() {
  background(255);

  // Draw ground texture with varying height
  const [inkR, inkG, inkB] = cachedValues.inkColor;
  stroke(inkR, inkG, inkB, 30);
  for (let i = 0; i < width; i += CONFIG.GROUND.LINE_SPACING) {
    let y =
      height * CONFIG.GROUND.HEIGHT_RATIO +
      random(-CONFIG.GROUND.VARIATION, CONFIG.GROUND.VARIATION);
    strokeWeight(random(0.5, 2));
    line(
      i,
      y,
      i + random(10, 30),
      y + random(-CONFIG.GROUND.VARIATION, CONFIG.GROUND.VARIATION)
    );
  }

  // Draw all trees from back to front
  trees.forEach((tree) => tree.draw());
}
