/*jshint eqnull:true*/

function _isPropname(memberExpression, identifier) {
	if (!memberExpression || memberExpression.type !== 'MemberExpression') {
		return false;
	}
	if (!identifier || identifier.type !== 'Identifier') {
		return false;
	}
	if (memberExpression.computed) {
		return false;
	}
	if (memberExpression.property !== identifier) {
		return false;
	}
	return true;
}

function extractIdNodes(ast) {
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
					if (astNode.type === 'FunctionDeclaration') {
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

				for (var i = 0; i < localIdNodes.length; i++) {
					if (Object.prototype.hasOwnProperty.call(localScope, localIdNodes[i].name)) {
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
				if (_isPropname(astStack[astStack.length - 2], astNode)) {
					break;
				}
				astNode.buildtimeReplace = true;
				idNodes.push({
					node: astNode,
					name: astNode.name,
					stack: astStack.slice() // Copy of array
				});
				break;
		}
		if (!skipIteration) {
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

function _calcUnaryExpression(unaryExpression) {
	if (!('buildtimeComputedValue' in unaryExpression.argument)) {
		return;
	}

	var value = unaryExpression.argument.buildtimeComputedValue;

	switch (unaryExpression.operator) {
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

function _calcBinaryExpression(binaryExpression) {
	if (!('buildtimeComputedValue' in binaryExpression.left)) {
		return;
	}
	if (!('buildtimeComputedValue' in binaryExpression.right)) {
		return;
	}

	var left = binaryExpression.left.buildtimeComputedValue;
	var right = binaryExpression.right.buildtimeComputedValue;

	switch (binaryExpression.operator) {
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

function query(path) {
	path = [].concat(path);
	var state = {
		"foo": 42,
		"obj": {
			"method": function(v) {
				return '<' + v + '>';
			}
		},
		"func": function(v) {
			return "func called with " + v;
		},
		"method": 44
	};

	var root = state;
	for (var depth = 0; depth < path.length; depth++) {
		if (root == null) {
			return;
		}
		if (!(path[depth] in root)) {
			return;
		}
		root = root[path[depth]];
	}
	return {
		'value': root
	};
}

function _replaceCall(callExpression) {
	if (!('buildtimeComputedValue' in callExpression.callee)) {
		return;
	}
	var method = callExpression.callee.buildtimeComputedValue;
	var base = null;

	if (callExpression.callee.type === 'MemberExpression') {
		if ('buildtimeComputedValue' in callExpression.callee.object) {
			base = callExpression.callee.object.buildtimeComputedValue;
		} else {
			return;
		}
	}

	var args = [];
	for (var i = 0; i < callExpression.arguments.length; i++) {
		if ('buildtimeComputedValue' in callExpression.arguments[i]) {
			args.push(callExpression.arguments[i].buildtimeComputedValue);
		}
	}
	try {
		var value = method.apply(base, args);
		callExpression.buildtimeComputedValue = value;
	} catch (e) {}
}

function _replaceIdentifier(identifier) {
	if (!identifier.buildtimeReplace) {
		return;
	}
	var name = identifier.name;
	var result = query(name);
	if (!result) {
		return;
	}
	identifier.buildtimeComputedValue = result.value;
	identifier.buildtimeReference = [name];
}

function _replaceMember(memberExpression) {
	if (!('buildtimeComputedValue' in memberExpression.object)) {
		return;
	}
	var object = memberExpression.object.buildtimeComputedValue;
	if (object == null) {
		return;
	}
	var propname;
	if (!memberExpression.computed) {
		if (memberExpression.property.type === 'Identifier') {
			propname = memberExpression.property.name;
		} else {
			return;
		}
	} else {
		if ('buildtimeComputedValue' in memberExpression.property) {
			propname = memberExpression.property.buildtimeComputedValue;
		} else {
			return;
		}
	}
	var value;
	if ('buildtimeReference' in memberExpression.object) {
		var reference = memberExpression.object.buildtimeReference.slice();
		reference.push(propname);
		memberExpression.buildtimeReference = reference;
		var result = query(reference);
		if (result) {
			value = result.value;
		} else {
			return;
		}
	} else {
		if (propname in object) {
			value = object[propname];
		} else {
			return;
		}
	}
	memberExpression.buildtimeComputedValue = value;
}

function _replaceExpressionStatement(expressionStatement) {
	if (!expressionStatement.expression) {
		return;
	}
	if ('buildtimeComputedValue' in expressionStatement.expression) {
		expressionStatement.buildtimeComputedValue = expressionStatement.expression.buildtimeComputedValue;
	}
}

function evaluateConsts(astNode) {
	if ('buildtimeComputedValue' in astNode) {
		return;
	}
	for (var key in astNode) {
		if (key !== 'range' && astNode[key] && typeof astNode[key] === 'object') {
			evaluateConsts(astNode[key]);
		}
	}
	switch (astNode.type) {
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
		case 'ExpressionStatement':
			_replaceExpressionStatement(astNode);
			break;
	}
	return;
}

function _serialize(value) {
	if (typeof value === 'string') {
		return JSON.stringify(value);
	}
	// TODO: -0 ?
	return '' + value;
}

function replace(code, replacements) {
	var right = 0;
	var chunks = [];

	replacements = replacements.slice().sort(function(a, b){
		return b.start - a.start;
	});
	console.log(replacements);
	// Prepare replacements
	for (var i = replacements.length; i--;) {
		var replacement = replacements[i];
		if (replacement.end <= right) {
			continue;
		}
		chunks.push(code.substring(right, replacement.start));
		chunks.push(replacement.value);
		right = replacement.end;
	}
	chunks.push(code.substring(right));
	return chunks.join('');
}

function _getIfReplacement(ifStatement, stack){
	var ownRange = ifStatement.range;

	var parentAstNode = null;
	for (var i=0; i<stack.length; i++){
		if (Array.isArray(stack[i])){
			continue;
		}
		if (stack[i] === ifStatement){
			break;
		}
		parentAstNode = stack[i];
	}

	var parentIsBlock = (parentAstNode && (parentAstNode.type === 'BlockStatement' || parentAstNode.type === 'Program'));

	var branch;
	if (ifStatement.test.buildtimeComputedValue){
		branch = ifStatement.consequent;
	} else if (ifStatement.alternative) {
		branch = ifStatement.alternative;
	}

	if (!branch || !branch.body.length){
		return [{
			start: ownRange[0],
			end: ownRange[1],
			value: parentIsBlock ? '' : ';'
		}];
	}
	var branchRange = branch.range;


	if (parentIsBlock && branch.type === 'BlockStatement'){
		branchRange = [branch.body[0].range[0], branch.body[branch.body.length - 1].range[1]];
	}

	return [{
		start: ownRange[0],
		end: branchRange[0],
		value: ''
	}, {
		start: branchRange[1],
		end: ownRange[1],
		value: ''
	}];
}

function inline(code, state) {
	var ast = require('esprima').parse(code, {
		range: true
	});
	require('fs').writeFileSync(require('path').resolve(__dirname, 'ast.json'), JSON.stringify(ast, null, '\t'));

	var idNodes = extractIdNodes(ast);
	var replacements = [];
	// For each matching identifier node in reverse order
	for (var i = idNodes.length; i--;) {
		var stack = idNodes[i].stack;
		var modifiedNode = null;
		var astNode;
		// Traverse up to the tree root while value is computable
		for (var j = stack.length; j--;) {
			astNode = stack[j];
			evaluateConsts(astNode);
			if (!('buildtimeComputedValue' in astNode)) {
				break;
			}
			if (Object(astNode.buildtimeComputedValue) === astNode.buildtimeComputedValue) {
				continue;
			}
			modifiedNode = astNode;
		}
		if (!modifiedNode){
			// There's nothing we can replace
			continue;
		}
		// Special case: expression is wrapped into if statement
		if (astNode && astNode.type === 'IfStatement' && astNode.test == modifiedNode){
			replacements = replacements.concat(_getIfReplacement(astNode, stack));
		} else {
			replacements.push({
				'start': modifiedNode.range[0],
				'end': modifiedNode.range[1],
				'value': _serialize(modifiedNode.buildtimeComputedValue)
			});
		}

	}

	require('fs').writeFileSync(require('path').resolve(__dirname, 'ast-after.json'), JSON.stringify(ast, null, '\t'));

	return replace(code, replacements);
}

module.exports.inline = inline;