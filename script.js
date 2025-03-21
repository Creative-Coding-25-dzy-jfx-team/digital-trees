let controls;
let chineseFont;
let growthProgress = 0;
let isGrowing = false;
let treeSeed;
let branchParams = [];

// Helper function to generate unique branch parameters
function generateBranchParams(depth, randomFactor) {
  let params = {
    length: random(0.65, 0.75),
    width: 0.7,
    leftAngle: random(-0.5, 0.5) * randomFactor,
    rightAngle: random(-0.5, 0.5) * randomFactor,
    curves: Array(3)
      .fill()
      .map(() => ({
        endX: random(-1, 1),
        endY: random(-1, 1),
        ctrl1X: random(0.2, 0.4),
        ctrl1Y: random(-1, 1),
        ctrl2X: random(0.6, 0.8),
        ctrl2Y: random(-1, 1),
        alpha: random(100, 255),
      })),
    splats:
      depth > 2
        ? Array(floor(random(3, 6)))
            .fill()
            .map(() => ({
              x: random(0, 1),
              y: random(-1, 1),
              alpha: random(50, 150),
            }))
        : [],
  };
  return params;
}

// Function to pre-calculate all branch parameters
function calculateTreeParameters() {
  randomSeed(treeSeed);
  branchParams = [];
  const maxDepth = parseInt(controls.depth.value);
  const randomFactor = map(
    parseInt(controls.randomness.value),
    0,
    10,
    0,
    1
  );

  // Calculate parameters for each depth level
  for (let depth = 0; depth <= maxDepth; depth++) {
    branchParams[depth] = [];
    // Pre-calculate more branches than needed to account for different depths
    const branchesAtDepth = pow(2, depth + 2);
    for (let i = 0; i < branchesAtDepth; i++) {
      branchParams[depth].push(generateBranchParams(depth, randomFactor));
    }
  }
}

function setup() {
  createCanvas(windowWidth * 0.8, windowHeight * 0.8);
  textFont("Noto Sans SC", 16);
  frameRate(60);

  controls = {
    depth: document.getElementById("depth"),
    initialLength: document.getElementById("initialLength"),
    branchAngle: document.getElementById("branchAngle"),
    randomness: document.getElementById("randomness"),
    growthSpeed: document.getElementById("growthSpeed"),
  };

  // Update value displays
  Object.keys(controls).forEach((key) => {
    const element = controls[key];
    const valueDisplay = document.getElementById(key + "Value");
    element.addEventListener("input", () => {
      valueDisplay.textContent = element.value;
    });
  });

  treeSeed = random(10000);
  calculateTreeParameters();
  redrawTree();
}

function windowResized() {
  resizeCanvas(windowWidth * 0.8, windowHeight * 0.8);
  redrawTree();
}

function drawBranch(
  x,
  y,
  len,
  angle,
  depth,
  width,
  progress,
  branchIndex = 0
) {
  // Scale length and width based on growth progress
  len = len * min(1, progress);
  width = width * min(1, progress);

  if (depth === 0 || !branchParams[depth] || branchIndex >= branchParams[depth].length) {
    // Draw '林' character at branch ends with gradual growth
    if (progress > 0.1) { // Only start showing leaves after branch has started growing
      let leafProgress = (progress - 0.1) * 1.2; // Normalize progress for leaves
      if (leafProgress > 0) {
        push();
        translate(x, y);
        rotate(-angle);
        
        // Calculate size based on growth progress
        let finalSize = 16;
        let currentSize = finalSize * min(1, leafProgress * 2);
        textSize(currentSize);
        textAlign(CENTER, CENTER);

        // Calculate alpha based on growth progress
        let shadowAlpha = 50 * leafProgress;
        let mainAlpha = 200 * leafProgress;

        // Draw green shadow for depth effect
        fill(34, 139, 34, shadowAlpha);
        noStroke();
        text("林", 1, 1);

        // Draw main character
        fill(34, 139, 34, mainAlpha);
        text("林", 0, 0);
        pop();
      }
    }
    return;
  }

  const params = branchParams[depth] ? branchParams[depth][branchIndex] : generateBranchParams(depth, map(parseInt(controls.randomness.value), 0, 10, 0, 1));
  push();
  translate(x, y);

  // Add ink texture effect using pre-calculated parameters
  for (let i = 0; i < 3; i++) {
    const curve = params.curves[i];
    let branchEndX = len * cos(-angle);
    let branchEndY = len * sin(-angle);

    // Use pre-calculated variations
    branchEndX += width * curve.endX;
    branchEndY += width * curve.endY;

    // Ink stroke effect
    stroke(0, curve.alpha);
    strokeWeight(width * random(0.8, 1.2));

    // Draw with pre-calculated curves
    let ctrl1X = len * curve.ctrl1X;
    let ctrl1Y = width * curve.ctrl1Y;
    let ctrl2X = len * curve.ctrl2X;
    let ctrl2Y = width * curve.ctrl2Y;

    noFill();
    bezier(0, 0, ctrl1X, ctrl1Y, ctrl2X, ctrl2Y, branchEndX, branchEndY);
  }

  // Add pre-calculated ink splatter effect
  params.splats.forEach((splat) => {
    stroke(0, splat.alpha);
    strokeWeight(random(1, 2));
    point(len * splat.x, width * splat.y);
  });

  // Calculate next branches using pre-calculated parameters
  let newLen = len * params.length;
  let newWidth = width * params.width;
  let branchAngle = radians(parseInt(controls.branchAngle.value));

  // Use pre-calculated angle variations
  let leftAngle = angle + branchAngle + params.leftAngle;
  let rightAngle = angle - branchAngle + params.rightAngle;

  // Recursively draw branches with consistent indices
  // Only draw further branches if we have enough progress
  if (progress > 0.1) {
    translate(len * cos(-angle), len * sin(-angle));
    let nextProgress = (progress - 0.1) * 1.2; // Delayed growth for child branches
    if (nextProgress > 0) {
      drawBranch(
        0,
        0,
        newLen,
        leftAngle,
        depth - 1,
        newWidth,
        nextProgress,
        branchIndex * 2
      );
      drawBranch(
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

function draw() {
  if (isGrowing) {
    let growthSpeed = parseInt(controls.growthSpeed.value);
    growthProgress = min(1, growthProgress + 0.001 * growthSpeed);
    if (growthProgress >= 1) {
      isGrowing = false;
    }
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
  stroke(0, 30);
  for (let i = 0; i < width; i += 20) {
    let y = height * 0.8 + random(-5, 5);
    strokeWeight(random(0.5, 2));
    line(i, y, i + random(10, 30), y + random(-5, 5));
  }

  // Draw main tree
  drawBranch(
    width / 2,
    height * 0.8,
    parseInt(controls.initialLength.value),
    PI / 2,
    parseInt(controls.depth.value),
    10,
    growthProgress
  );
}
