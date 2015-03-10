var state = {
	'Application': {
		'Features': {
			'isFeatureEnabled': function(featureName){
				console.log('Quering ' + featureName);
				return {
					'foo': true,
					'bar': true,
					'baz': true
				}[featureName];
			}
		},
	},
	'__environment': 'prod'
};

var result = require('../lib/rhubarb.node.js').inline(
	require('fs').readFileSync('code.js', 'utf-8'), state,
	{
		scope: 'undeclared'
	}
);

console.log(result);