// The scenery groups of docs/tactics/SCENERY-PORT-HANDOFF.md, one per Stage 1 parcel.
// This is the ONLY file that lists them. A parcel fills in its own environment-props-<folder>.js,
// prop-art-<folder>.js and manifest-<folder>.json and never opens a shared registry.
import * as lighting from './environment-props-lighting.js';
import * as towers from './environment-props-towers.js';
import * as cargo from './environment-props-cargo.js';
import * as furniture from './environment-props-furniture.js';
import * as machines from './environment-props-machines.js';
import * as conveyor from './environment-props-conveyor.js';
import * as vehicles from './environment-props-vehicles.js';

export const GROUPS=[lighting,towers,cargo,furniture,machines,conveyor,vehicles];
// Merged rules for every filled-in group. Empty until a parcel lands, so this is a no-op today.
export const GROUP_PROPS=Object.assign({},...GROUPS.map(g=>g.PROPS));
// Editor palette headings, keyed by the asset folder a sprite lives in.
export const GROUP_LABELS=Object.fromEntries(GROUPS.map(g=>[g.FOLDER,g.LABEL]));
