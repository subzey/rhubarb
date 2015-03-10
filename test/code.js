if (Application.Features.isFeatureEnabled('foo')){
	console.log('okay');
} else {
	console.log('fail');
}

if (Application.Features.isFeatureEnabled(['foo', 'zoo'][(__environment === 'prod') ? 1 : 0])){
	console.log('fail');
} else {
	console.log('okay');
}

if (Application.Features.noSuchMethod(__environment)){
	console.log('???');
}

if (42){
	console.log('okay');
} else {
	console.log('okay');
}