var obj = {};

if (obj.method(42) || z()){
	console.log(obj.method(42).toString());
} else {
	console.log('else');
}

(function(obj){
	obj.method();
})();

obj.notExists;