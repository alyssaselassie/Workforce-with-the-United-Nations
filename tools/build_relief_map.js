#!/usr/bin/env node
// Regenerates the Qualtrics import file and the fictional sample export from relief-map/relief-map.js.
// Run after changing the survey or the sample:  node tools/build_relief_map.js
const fs = require('fs');
const path = require('path');
const RM = require('../relief-map/relief-map.js');

const dir = path.join(__dirname, '..', 'relief-map');
fs.writeFileSync(path.join(dir, 'relief-map-survey.txt'), RM.qualtricsTxt());
fs.writeFileSync(path.join(dir, 'sample-qualtrics-export.csv'), RM.toQualtricsCSV(RM.sampleRespondents()));
console.log('Wrote relief-map/relief-map-survey.txt and relief-map/sample-qualtrics-export.csv');
