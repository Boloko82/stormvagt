// The cut-open lighthouse, shared by the server (rules) and the browser (drawing).
// Coordinates are in the 320x180 pixel world; y is the floor surface a keeper stands on.
export const LAYOUT = Object.freeze({
  floors: [
    { id: 'lantern', y: 56, left: 110, right: 210 },
    { id: 'workshop', y: 92, left: 110, right: 210 },
    { id: 'oil', y: 128, left: 110, right: 210 },
    { id: 'cellar', y: 166, left: 110, right: 210 },
  ],
  ladder: { x: 160, top: 56, bottom: 166 },
  stations: [
    { id: 'crankLeft', kind: 'crankLeft', floor: 'lantern', x: 124 },
    { id: 'lamp', kind: 'lamp', floor: 'lantern', x: 142 },
    { id: 'lens', kind: 'lens', floor: 'lantern', x: 178 },
    { id: 'crankRight', kind: 'crankRight', floor: 'lantern', x: 196 },
    { id: 'boards', kind: 'boards', floor: 'workshop', x: 132 },
    { id: 'barrels', kind: 'barrels', floor: 'oil', x: 188 },
    { id: 'pump', kind: 'pump', floor: 'cellar', x: 132 },
  ],
  windows: [
    { id: 'lantern-left', floor: 'lantern', x: 110, side: 'left' },
    { id: 'lantern-right', floor: 'lantern', x: 210, side: 'right' },
    { id: 'workshop-left', floor: 'workshop', x: 110, side: 'left' },
    { id: 'workshop-right', floor: 'workshop', x: 210, side: 'right' },
    { id: 'oil-left', floor: 'oil', x: 110, side: 'left' },
    { id: 'oil-right', floor: 'oil', x: 210, side: 'right' },
  ],
});
