var assert = require("assert");
var rhubarb = require("../lib/rhubarb.node.js");
var esprima = require("esprima");

describe('Basic', function(){
	it('Should work', function(){
		var code = "1";
		var expected = code;
		var result = rhubarb.inline(code);
		assert.equal(expected, result);
	});
	it('Should replace strings', function(){
		var code = "foo";
		var expected = '"bar"';
		var result = rhubarb.inline(code, {
			foo: "bar"
		});
		assert.equal(expected, result);
	});
	it('Should replace numbers', function(){
		var code = "foo";
		var expected = '42';
		var result = rhubarb.inline(code, {
			foo: 42
		});
		assert.equal(expected, result);
	});
	it('Should replace booleans', function(){
		var code = "foo";
		var expected = 'true';
		var result = rhubarb.inline(code, {
			foo: true
		});
		assert.equal(expected, result);
	});
	it('Should not replace unknown values', function(){
		var code = "foo";
		var expected = code;
		var result = rhubarb.inline(code);
		assert.equal(expected, result);
	});
});

describe('Properties', function(){
	it('Should use properties', function(){
		var code = "foo.bar.baz";
		var expected = '42';
		var result = rhubarb.inline(code, {
			foo: {
				bar: {
					baz: 42
				}
			}
		});
		assert.equal(expected, result);
	});
	it('Should resolve paths correctly', function(){
		var code = "foo.bar.baz";
		var expected = '42';
		var result = rhubarb.inline(code, {
			foo: {
				bar: {
					baz: 42
				}
			},
			bar: {
				baz: 33
			},
			baz: 33
		});
		assert.equal(expected, result);
	});
});

describe('Expressions', function(){
	it('Should calculate binary expressions', function(){
		var code = "(seven * three) * ((1 | 2) - 1)";
		var expected = '42';
		var result = rhubarb.inline(code, {
			seven: 7,
			three: 3
		});
		assert.equal(expected, result);
	});
	it('Should calculate unary expressions', function(){
		var code = "(seven * three) * (-~void 0+-~!+1)";
		var expected = '42';
		var result = rhubarb.inline(code, {
			seven: 7,
			three: 3
		});
		assert.equal(expected, result);
	});
});

describe('Function calls', function(){
	it('Should call functions', function(){
		var code = "func(1, 2, 3)";
		var expected = '"1*2*3"';
		var result = rhubarb.inline(code, {
			func: function(a, b, c){
				return [a,b,c].join('*');
			}
		});
		assert.equal(expected, result);
	});
	it('Should calculate expressions within args', function(){
		var code = "func(1, 1 + 1, 1 + 1 + 1)";
		var expected = '"1*2*3"';
		var result = rhubarb.inline(code, {
			func: function(a, b, c){
				return [a,b,c].join('*');
			}
		});
		assert.equal(expected, result);
	});
	it('Should not call if calculated value is unknown', function(){
		var code = "func(1, 1 + 1, dunno)";
		var expected = code;
		var result = rhubarb.inline(code, {
			func: function(a, b, c){
				return [a,b,c].join('*');
			}
		});
		assert.equal(expected, result);
	});
	it('Should use correct this', function(){
		var code = "obj.method()";
		var expected = '42';
		var result = rhubarb.inline(code, {
			obj: {
				method: function(){
					return this.value;
				},
				value: 42
			}
		});
		assert.equal(expected, result);
	});
});

describe('Scopes', function(){
	it('Should replace only global entries', function(){
		var code = [
			"var foo;",
			"var z = foo;",
			"function test(foo){",
			"\tvar z = foo;",
			"}"
		].join('\n');
		var expected = [
			"var foo;",
			"var z = 42;",
			"function test(foo){",
			"\tvar z = foo;",
			"}"
		].join('\n');
		var result = rhubarb.inline(code, {
			foo: 42
		});
		assert.equal(expected, result);
	});
	it('Should replace all entries in flat mode', function(){
		var code = [
			"var foo;",
			"var z = foo;",
			"function test(foo){",
			"\tvar z = foo;",
			"}"
		].join('\n');
		var expected = [
			"var foo;",
			"var z = 42;",
			"function test(foo){",
			"\tvar z = 42;",
			"}"
		].join('\n');
		var result = rhubarb.inline(code, {
			foo: 42
		}, {
			'scope': 'flat'
		});
		assert.equal(expected, result);
	});
	it('Should replace only undeclared entries in undeclared mode', function(){
		var code = [
			"var foo;",
			"var z = foo;",
			"var y = bar;",
			"function test(foo){",
			"\tvar z = foo;",
			"\tvar y = bar;",
			"}"
		].join('\n');
		var expected = [
			"var foo;",
			"var z = foo;",
			"var y = 33;",
			"function test(foo){",
			"\tvar z = foo;",
			"\tvar y = 33;",
			"}"
		].join('\n');
		var result = rhubarb.inline(code, {
			foo: 42,
			bar: 33
		}, {
			'scope': 'undeclared'
		});
		assert.equal(expected, result);
	});
});

// describe('Conditional compilation', function(){
// 	it('Should remove if statement branches', function(){
// 		var code = [
// 			"if (foo){",
// 			"\ttruthy1();",
// 			"} else {",
// 			"\tfalsy1();",
// 			"}",
// 			"if (!foo){",
// 			"\ttruthy2();",
// 			"} else {",
// 			"\tfalsy2();",
// 			"}"
// 		].join('\n');
// 		var expected = [
// 			"truthy1();",
// 			"falsy2();"
// 		].join('\n');
// 		var result = rhubarb.inline(code, {
// 			foo: 42
// 		});
// 		assert.equal(expected, result);
// 	});
// 	it('Should work with nested ifs', function(){
// 		var code = [
// 			"if (foo){",
// 			"truthy1();",
// 			"if (bar){",
// 			"truthy2();",
// 			"}",
// 			"}"
// 		].join('\n');
// 		var expected = [
// 			"truthy1();",
// 			"truthy2();"
// 		].join('\n');
// 		var result = rhubarb.inline(code, {
// 			foo: 42,
// 			bar: 'whatever'
// 		});
// 		assert.equal(expected, result);
// 	});

// 	it('Should work with else if', function(){
// 		var code = [
// 			"if (foo) {",
// 				"nope1();",
// 			"} else if (bar) {",
// 				"nope2();",
// 			"} else {",
// 				"fallback();",
// 			"}"
// 		].join('\n');
// 		var expected = [
// 			"fallback();"
// 		].join('\n');
// 		var result = rhubarb.inline(code, {
// 			foo: 0,
// 			bar: null
// 		});
// 		assert.equal(expected, result);
// 	});
// });

describe("builtins", function(){
	it('Should use builtins', function(){
		var code = "foo * (isFinite(Math.max(42, Infinity)) ? 1 : 2)";
		var expected = '42';
		var result = rhubarb.inline(code, {
			foo: 21
		});
		assert.equal(expected, result);
	});
	it('Should not use builtins if shadowed', function(){
		var code = [
			"var omg = function(){",
				"// I fixed it!",
				"var undefined = function(){}",
				"console.log(typeof undefined)",
			"}"
		].join('\n');
		var expected = code;
		var result = rhubarb.inline(code);
		assert.equal(expected, result);
	});
	it('Should prefer state over builtin', function(){
		var code = "Infinity";
		var expected = "42";
		var result = rhubarb.inline(code, {
			"Infinity": 42
		});
		assert.equal(expected, result);
	});
});