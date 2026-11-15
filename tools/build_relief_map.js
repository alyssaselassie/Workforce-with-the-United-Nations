#!/usr/bin/env node
// Regenerates the Qualtrics import file, the fictional sample export and the codebook from
// relief-map/relief-map.js, so every file uses exactly the same questions and codes.
// Usage: node tools/build_relief_map.js
const fs = require('fs');
const path = require('path');
const RM = require('../relief-map/relief-map.js');

const dir = path.join(__dirname, '..', 'relief-map');
fs.writeFileSync(path.join(dir, 'relief-map-survey.txt'), RM.qualtricsTxt());
fs.writeFileSync(path.join(dir, 'sample-qualtrics-export.csv'), RM.toQualtricsCSV());
fs.writeFileSync(path.join(dir, 'relief-map-codebook.csv'), '﻿' + RM.codebookCSV());
console.log('Wrote relief-map-survey.txt, sample-qualtrics-export.csv and relief-map-codebook.csv in relief-map/');
