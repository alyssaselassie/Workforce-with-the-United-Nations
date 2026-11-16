#!/usr/bin/env node
// Regenerates the Qualtrics import file, the codebook and the demonstration export from
// workforce-survey/workforce-survey.js. Usage: node tools/build_workforce_survey.js
const fs = require('fs');
const path = require('path');
const W = require('../workforce-survey/workforce-survey.js');

const dir = path.join(__dirname, '..', 'workforce-survey');
fs.writeFileSync(path.join(dir, 'workforce-survey-qualtrics.txt'), W.qualtricsTxt());
fs.writeFileSync(path.join(dir, 'workforce-survey-codebook.csv'), W.codebookCSV());
fs.writeFileSync(path.join(dir, 'demo-qualtrics-export.csv'), W.demoCSV());
console.log('Wrote workforce-survey-qualtrics.txt, workforce-survey-codebook.csv and demo-qualtrics-export.csv in workforce-survey/');
