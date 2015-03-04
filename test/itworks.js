var result = require('../lib/rhubarb.node.js').inline(
	require('fs').readFileSync('code.js', 'utf-8'), {}
);

console.log(result);