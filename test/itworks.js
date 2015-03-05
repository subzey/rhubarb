var result = require('../lib/rhubarb.node.js').inline(
	require('fs').readFileSync('code.js', 'utf-8'), {
		globalFoo: 33,
		obj: {
			foo: 42,
			method: function(v){
				return '<' + v + '>';
			}
		}
	},
	{
		scope: ''
	}
);

console.log(result);