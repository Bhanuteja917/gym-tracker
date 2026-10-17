// How the group shapes in shapes.mjs split into individual muscles.
//
// SPLITS: for each group shape, its muscles in order with the region (a
// polygon on the figure's left half, mirrored for the right) that each takes
// from what is left of the shape; the last muscle (region null) takes the rest.
// ADDED: muscles with no group shape, drawn as polygons and trimmed so they
// stay inside the body and off the other muscles.
// Ids must match the parts in src/lib/muscles.ts.

const BELOW = 500; // past the bottom of the figure

// prettier-ignore
export const FRONT = {
  splits: {
    traps: [['upper-traps', null]],
    'front-shoulders': [
      ['side-delts', [[0, 0], [62, 70], [53, 125], [0, 125]]],
      ['front-delts', null],
    ],
    chest: [
      ['upper-chest', [[50, 60], [101, 60], [101, 95.5], [80, 94], [60, 91]]],
      ['lower-chest', [[50, 105], [80, 109.5], [101, 110], [101, 130], [50, 130]]],
      ['mid-chest', null],
    ],
    biceps: [
      ['brachialis', [[30, 141], [50, 145], [53.5, 152], [52, 170], [30, 170]]],
      ['biceps-long', [[30, 100], [56.5, 110], [54.5, 140], [53.5, 170], [30, 170]]],
      ['biceps-short', null],
    ],
    forearms: [
      ['brachioradialis', [[30, 150], [51.5, 156], [47, 176], [41, 196], [30, 200]]],
      ['wrist-flexors', null],
    ],
    obliques: [
      ['serratus', [[60, 110], [84, 110], [78, 128], [74, 143], [60, 147]]],
      ['external-obliques', null],
    ],
    abdominals: [
      ['upper-abs', [[80, 100], [101, 100], [101, 161.5], [94, 161.6], [88, 163], [80, 163]]],
      ['lower-abs', null],
    ],
    quads: [
      ['inner-quad', [[85, 258], [101, 258], [101, 320], [74, 320], [79, 296], [80, 280]]],
      ['outer-quad', [[0, 200], [72.5, 220], [72, 245], [73, 270], [77, 300], [77, 320], [0, 320]]],
      ['rectus-femoris', null],
    ],
    adductors: [['adductors', null]],
    abductors: [['abductors', null]],
    calves: [
      ['tibialis', [[0, 300], [79.5, 305], [78.5, 340], [76.5, 380], [0, 380]]],
      ['soleus', [[0, 345], [101, 345], [101, BELOW], [0, BELOW]]],
      ['gastrocnemius', null],
    ],
  },
  added: {
    // Sternocleidomastoid, from behind the ear down to the collarbone.
    neck: [[87, 52], [90.5, 52], [95, 66], [99, 79], [99, 84], [95.5, 84], [91, 70]],
    'hip-flexors': [[80, 225], [90, 222.5], [96.5, 226], [95.5, 234], [91, 244], [86, 238]],
  },
};

// prettier-ignore
export const BACK = {
  splits: {
    traps: [['upper-traps', null]],
    'rear-shoulders': [
      ['side-delts', [[0, 0], [62, 70], [53, 125], [0, 125]]],
      ['rear-delts', null],
    ],
    triceps: [
      ['triceps-medial', [[30, 149], [70, 152], [70, 170], [30, 170]]],
      ['triceps-lateral', [[30, 100], [56, 110], [53.5, 135], [51.5, 152], [30, 152]]],
      ['triceps-long', null],
    ],
    forearms: [['wrist-extensors', null]],
    'traps-middle': [
      ['middle-traps', [[60, 80], [101, 80], [101, 104.5], [70, 103]]],
      ['rhomboids', [[60, 103], [101, 104.5], [101, 116], [89, 113], [60, 106]]],
      ['lower-traps', null],
    ],
    lats: [
      ['teres-major', [[50, 95], [80, 95], [74, 108], [69, 119], [50, 122]]],
      ['latissimus', null],
    ],
    'lower-back': [['lower-back', null]],
    glutes: [
      ['glute-med', [[50, 190], [96, 200], [86, 211], [77, 222], [69, 238], [50, 238]]],
      ['glute-max', null],
    ],
    hamstrings: [
      ['outer-hamstring', [[0, 240], [80.5, 245], [81, 262], [82.5, 276], [82.5, 290], [82, 302], [82, 320], [0, 320]]],
      ['inner-hamstring', null],
    ],
    calves: [
      ['soleus', [[0, 346], [79, 356], [101, 346], [101, BELOW], [0, BELOW]]],
      ['gastrocnemius', null],
    ],
  },
  added: {
    // Upper neck extensors, above the traps.
    neck: [[91.5, 45], [99, 45], [99, 60], [95.5, 62], [90, 55]],
    // Infraspinatus and teres minor, on the shoulder blade.
    'rotator-cuff': [[69, 85], [86, 90.5], [84, 96], [77, 101], [70, 104], [66.5, 96]],
  },
};

/** Divisions drawn over the muscles where a muscle has no split of its own (six-pack, spine, two-headed calves). */
export const FRONT_LINES = 'M88 142C93 140.5 107 140.5 112 142 M88.5 185C93 183.5 107 183.5 111.5 185 M100 122V220';
export const BACK_LINES = 'M100 132V202 M79 318C78 330 78 342 78.8 354.3 M121 318C122 330 122 342 121.2 354.3';
