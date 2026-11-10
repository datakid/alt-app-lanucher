'use strict';
var fs = require('fs');
var path = require('path');
var loader = require('./loader');

function make() {
  var F = loader.loadCore(null, { url: true, scripts: ['js/xlsx.js', 'js/mine-core.js'] }).F;
  var dir = path.join(loader.root, 'templates');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'fihrist-links-template.xlsx'), Buffer.from(F.xlsx.write(F.mineio.templateSheets())));
  fs.writeFileSync(path.join(dir, 'fihrist-links-template.csv'), F.mineio.templateCSV(), 'utf8');
  return dir;
}

module.exports = { make: make };

if (require.main === module) console.log('wrote ' + make());
