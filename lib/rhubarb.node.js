/*jshint eqnull:true*/

function _isPropname(memberExpression, identifier){
	if (!memberExpression || memberExpression.type !== 'MemberExpression'){
		return false;
	}
	if (!identifier || identifier.type !== 'Identifier'){
		return false;
	}
	if (memberExpression.computed){
		return false;
	}
	if (memberExpression.property !== identifier){
		return false;
	}
	return true;
}

function extractIdNodes(ast){
	var astStack = [];

	function detect(astNode, idNodes, scope) {
		astStack.push(astNode);
		var skipIteration = false;
		switch (astNode.type) {
			case 'FunctionDeclaration':
			case 'FunctionExpression':
			case 'ArrowFunctionExpression':
				var localScope = {};

				if (astNode.id) {
					if (astNode.type === 'FunctionDeclaration'){
						scope[astNode.id.name] = true;
					} else {
						// Looks like arrow function cannot have id. But whatever.
						localScope[astNode.id.name] = true;
					}
				}
				for (var i = 0; i < astNode.params.length; i++) {
					localScope[astNode.params[i].name] = true;
				}

				var localIdNodes = detect(astNode.body, [], localScope);

				for (var i=0; i<localIdNodes.length; i++){
					if (Object.prototype.hasOwnProperty.call(localScope, localIdNodes[i].name)){
						continue;
					}
					idNodes.push(localIdNodes[i]);
				}

				skipIteration = true;
				break;
			case 'VariableDeclarator':
				scope[astNode.id.name] = true;
				break;
			case 'Identifier':
				var parentAstNode = astStack[astStack.length - 2];
				if (_isPropname(astStack[astStack.length - 2], astNode)){
					break;
				}
				var pointOfInterest = astNode;
				astNode.buildtimeReplace = true;
				for (var i=astStack.length - 2; i >= 0; i--){
					if (
						astStack[i].type === 'MemberExpression' && astStack[i].object === pointOfInterest ||
						astStack[i].type === 'CallExpression'
					){
						pointOfInterest = astStack[i];
					} else {
						break;
					}
				}
				idNodes.push({
					node: astNode,
					name: astNode.name,
					poi: pointOfInterest
				});
				break;
		}
		if (!skipIteration){
			for (var key in astNode) {
				if (key !== 'range' && astNode[key] && typeof astNode[key] === 'object') {
					detect(astNode[key], idNodes, scope);
				}
			}
		}

		astStack.pop();
		return idNodes;
	}

	var globalScope = {};
	var globalIdNodes = [];
	detect(ast, globalIdNodes, globalScope);

	return globalIdNodes;
	// We also have globalScope dictionary with all the varnames that were defined explicitly.
}

function _calcUnaryExpression(unaryExpression){
	if (!('buildtimeComputedValue' in unaryExpression.argument)){
		return;
	}

	var value = unaryExpression.argument.buildtimeComputedValue;

	switch(unaryExpression.operator){
		case '+':
			unaryExpression.buildtimeComputedValue = +value;
			break;
		case '-':
			unaryExpression.buildtimeComputedValue = -value;
			break;
		case '~':
			unaryExpression.buildtimeComputedValue = ~value;
			break;
		case '!':
			unaryExpression.buildtimeComputedValue = !value;
			break;
	}
}

function _calcBinaryExpression(binaryExpression){
	if (!('buildtimeComputedValue' in binaryExpression.left)){
		return;
	}
	if (!('buildtimeComputedValue' in binaryExpression.right)){
		return;
	}

	var left = binaryExpression.left.buildtimeComputedValue;
	var right = binaryExpression.right.buildtimeComputedValue;

	switch(binaryExpression.operator){
		case '+':
			binaryExpression.buildtimeComputedValue = left + right;
			break;
		case '-':
			binaryExpression.buildtimeComputedValue = left - right;
			break;
		case '/':
			binaryExpression.buildtimeComputedValue = left / right;
			break;
		case '*':
			binaryExpression.buildtimeComputedValue = left * right;
			break;
		case '|':
			binaryExpression.buildtimeComputedValue = left | right;
			break;
		case '&':
			binaryExpression.buildtimeComputedValue = left & right;
			break;
		case '^':
			binaryExpression.buildtimeComputedValue = left ^ right;
			break;
		case '%':
			binaryExpression.buildtimeComputedValue = left % right;
			break;
	}
}

function query(path){
	path = [].concat(path);
	var state = {
		"foo": 42,
		"obj": {
			"method": function(v){
				return '<' + v + '>';
			}
		},
		"func": function(v){
			return "func called with " + v;
		},
		"method": 44
	};

	var root = state;
	for (var depth = 0; depth < path.length; depth++){
		if (root == null){
			return;
		}
		if (!(path[depth] in root)){
			return;
		}
		root = root[path[depth]];
	}
	return {'value': root};
}

function _replaceCall(callExpression){
	if (!('buildtimeComputedValue' in callExpression.callee)){
		return;
	}
	var method = callExpression.callee.buildtimeComputedValue;
	var base = null;

	if (callExpression.callee.type === 'MemberExpression'){
		if ('buildtimeComputedValue' in callExpression.callee.object){
			base = callExpression.callee.object.buildtimeComputedValue;
		} else {
			return;
		}
	}

	var args = [];
	for (var i=0; i<callExpression.arguments.length; i++){
		if ('buildtimeComputedValue' in callExpression.arguments[i]){
			args.push(callExpression.arguments[i].buildtimeComputedValue);
		}
	}
	try {
		var value = method.apply(base, args);
		callExpression.buildtimeComputedValue = value;
	} catch (e){}
}

function _replaceIdentifier(identifier){
	if (!identifier.buildtimeReplace){
		return;
	}
	var name = identifier.name;
	var result = query(name);
	if (!result){
		return;
	}
	identifier.buildtimeComputedValue = result.value;
	identifier.buildtimeReference = [name];
}

function _replaceMember(memberExpression){
	if (!('buildtimeComputedValue' in memberExpression.object)){
		return;
	}
	var object = memberExpression.object.buildtimeComputedValue;
	if (object == null){
		return;
	}
	var propname;
	if (!memberExpression.computed){
		if (memberExpression.property.type === 'Identifier'){
			propname = memberExpression.property.name;
		} else {
			return;
		}
	} else {
		if ('buildtimeComputedValue' in memberExpression.property){
			propname = memberExpression.property.buildtimeComputedValue;
		} else {
			return;
		}
	}
	var value;
	if ('buildtimeReference' in memberExpression.object){
		var reference = memberExpression.object.buildtimeReference.slice();
		reference.push(propname);
		memberExpression.buildtimeReference = reference;
		var result = query(reference);
		if (result){
			value = result.value;
		} else {
			return;
		}
	} else {
		if (propname in object){
			value = object[propname];
		} else {
			return;
		}
	}
	console.log('member', object, propname, value);
	memberExpression.buildtimeComputedValue = value;
}

function evaluateConsts(astNode){
	if ('buildtimeComputedValue' in astNode){
		return;
	}
	for (var key in astNode){
		if (key !== 'range' && astNode[key] && typeof astNode[key] === 'object') {
			evaluateConsts(astNode[key]);
		}
	}
	switch (astNode.type){
		case 'Literal':
			astNode.buildtimeComputedValue = astNode.value;
			break;
		case 'UnaryExpression':
			_calcUnaryExpression(astNode);
			break;
		case 'BinaryExpression':
			_calcBinaryExpression(astNode);
			break;
		case 'Identifier':
			_replaceIdentifier(astNode);
			break;
		case 'CallExpression':
			_replaceCall(astNode);
			break;
		case 'MemberExpression':
			_replaceMember(astNode);
			break;
	}
}

function inline(code, state) {
	var ast = require('esprima').parse(code, {
		range: true
	});
	require('fs').writeFileSync(require('path').resolve(__dirname, 'ast.json'), JSON.stringify(ast, null, '\t'));

	var idNodes = extractIdNodes(ast);
	for (var i=idNodes.length; i--;){
		evaluateConsts(idNodes[i].poi);
	}

	require('fs').writeFileSync(require('path').resolve(__dirname, 'ast-after.json'), JSON.stringify(ast, null, '\t'));
}

module.exports.inline = inline;