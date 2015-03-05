obj.foo = 33;
obj[globalFoo] = 77;
globalFoo = 22;
var globalFoo = 22;

globalFoo++;

obj.foo++;

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