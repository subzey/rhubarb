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

function extractIdNodes(ast, scopeBehavior) {
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
					if (scopeBehavior !== 'flat'){ // Do not check scopes at all
						if (Object.prototype.hasOwnProperty.call(localScope, localIdNodes[i].name)) {
							continue;
						}
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

	var filteredNodes;
	if (scopeBehavior === 'undeclared'){
		// Strictest mode, variables declared in global scope are not evaluated
		filteredNodes = [];
		for (var i=0; i<globalIdNodes.length; i++){
			if (Object.prototype.hasOwnProperty.call(globalScope, globalIdNodes[i].name)) {
				continue;
			}
			filteredNodes.push(globalIdNodes[i]);
		}
	} else {
		filteredNodes = globalIdNodes;
	}

	return filteredNodes;
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
		case 'typeof':
			unaryExpression.buildtimeComputedValue = typeof value;
			break;
		case 'void':
			// Despite the fact we don't need actual value, we still must check for its presence
			// Code golfing dudes may want to write something like this:
			// var foo = void f();
			unaryExpression.buildtimeComputedValue = undefined;
			break;
//		case 'delete':
//			// This operator has side effects, we cannot compute it
//			break;
	}
}

function _calcLogicalExpression(logicalExpression) {
	if (!('buildtimeComputedValue' in logicalExpression.left)) {
		return;
	}
	var left = logicalExpression.left.buildtimeComputedValue;

	// Short circuit evaluation
	if (
		logicalExpression.operator === '&&' && !left ||
		logicalExpression.operator === '||' && left
	){
		logicalExpression.buildtimeComputedValue = left;
		return;
	}


	if (!('buildtimeComputedValue' in logicalExpression.right)) {
		return;
	}

	var right = logicalExpression.right.buildtimeComputedValue;

	switch (logicalExpression.operator) {
		case '&&':
			logicalExpression.buildtimeComputedValue = left && right;
			break;
		case '||':
			logicalExpression.buildtimeComputedValue = left || right;
			break;
	}
}

function _calcBinaryExpression(binaryExpression) {
	if (!('buildtimeComputedValue' in binaryExpression.left)) {
		return;
	}
	var left = binaryExpression.left.buildtimeComputedValue;

	if (!('buildtimeComputedValue' in binaryExpression.right)) {
		return;
	}

	var right = binaryExpression.right.buildtimeComputedValue;

	switch (binaryExpression.operator) {
		case '*':
			binaryExpression.buildtimeComputedValue = left * right;
			break;
		case '/':
			binaryExpression.buildtimeComputedValue = left / right;
			break;
		case '%':
			binaryExpression.buildtimeComputedValue = left % right;
			break;
		case '+':
			binaryExpression.buildtimeComputedValue = left + right;
			break;
		case '-':
			binaryExpression.buildtimeComputedValue = left - right;
			break;
		case '<<':
			binaryExpression.buildtimeComputedValue = left << right;
			break;
		case '>>':
			binaryExpression.buildtimeComputedValue = left >> right;
			break;
		case '>>>':
			binaryExpression.buildtimeComputedValue = left >>> right;
			break;
		case '<':
			binaryExpression.buildtimeComputedValue = left < right;
			break;
		case '<=':
			binaryExpression.buildtimeComputedValue = left <= right;
			break;
		case '>':
			binaryExpression.buildtimeComputedValue = left > right;
			break;
		case '>=':
			binaryExpression.buildtimeComputedValue = left >= right;
			break;
		case 'in':
			binaryExpression.buildtimeComputedValue = left in right;
			break;
		case 'instanceof':
			binaryExpression.buildtimeComputedValue = left instanceof right;
			break;
		case '==':
			binaryExpression.buildtimeComputedValue = left == right;
			break;
		case '!=':
			binaryExpression.buildtimeComputedValue = left != right;
			break;
		case '===':
			binaryExpression.buildtimeComputedValue = left === right;
			break;
		case '!==':
			binaryExpression.buildtimeComputedValue = left !== right;
			break;
		case '&':
			binaryExpression.buildtimeComputedValue = left & right;
			break;
		case '^':
			binaryExpression.buildtimeComputedValue = left ^ right;
			break;
		case '|':
			binaryExpression.buildtimeComputedValue = left | right;
			break;
	}
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

function _replaceIdentifier(identifier, query) {
	if (!identifier.buildtimeReplace) {
		return;
	}
	var reference = [identifier.name];
	var result = query(reference.slice());
	if (!result) {
		return;
	}
	identifier.buildtimeComputedValue = result.value;
	identifier.buildtimeReference = reference;
}

function _replaceMember(memberExpression, query) {
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
		var result = query(reference.slice());
		if (result) {
			value = result.value;
		} else {
			return;
		}
	} else {
		object = Object(object);
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

function _replaceConditionalExprssion(ternary){
	if (!('buildtimeComputedValue' in ternary.test)) {
		return;
	}
	var branch;
	if (ternary.test.buildtimeComputedValue){
		branch = ternary.consequent;
	} else {
		branch = ternary.alternate;
	}
	if (!('buildtimeComputedValue' in branch)) {
		return;
	}
	ternary.buildtimeComputedValue = branch.buildtimeComputedValue;
}

function evaluateConsts(astNode, query) {
	if ('buildtimeComputedValue' in astNode) {
		return;
	}
	for (var key in astNode) {
		if (key !== 'range' && astNode[key] && typeof astNode[key] === 'object') {
			evaluateConsts(astNode[key], query);
		}
	}
	switch (astNode.type) {
		case 'Identifier':
			_replaceIdentifier(astNode, query);
			break;
		case 'MemberExpression':
			_replaceMember(astNode, query);
			break;
		case 'Literal':
			astNode.buildtimeComputedValue = astNode.value;
			break;
		case 'UnaryExpression':
			_calcUnaryExpression(astNode);
			break;
		case 'BinaryExpression':
			_calcBinaryExpression(astNode);
			break;
		case 'LogicalExpression':
			_calcLogicalExpression(astNode);
			break;
		case 'CallExpression':
			_replaceCall(astNode);
			break;
		case 'ExpressionStatement':
			_replaceExpressionStatement(astNode);
			break;
		case 'ConditionalExpression':
			_replaceConditionalExprssion(astNode);
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
	} else if (ifStatement.alternate) {
		branch = ifStatement.alternate;
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

function _normalizeOptions(dirtyOptions){
	var options = {
		'scope': 'global'
	};
	if (!dirtyOptions){
		return options;
	}
	if (dirtyOptions.scope === 'undeclared' || dirtyOptions.scope === 'flat'){
		options.scope = dirtyOptions.scope;
	}
	return options;
}

function inline(code, state, options) {
	var opts = _normalizeOptions(options);

	var ast = require('esprima').parse(code, {
		range: true
	});

	function query(path) {
		var root = state;
		for (var depth = 0; depth < path.length; depth++) {
			if (root == null) {
				return;
			}
			if (!(path[depth] in Object(root))) {
				return;
			}
			root = root[path[depth]];
		}
		return {
			'value': root
		};
	}


	require('fs').writeFileSync(require('path').resolve(__dirname, 'ast.json'), JSON.stringify(ast, null, '\t'));

	var idNodes = extractIdNodes(ast, opts.scope);
	var replacements = [];
	// For each matching identifier node in reverse order
	for (var i = idNodes.length; i--;) {
		var stack = idNodes[i].stack;
		var modifiedNode = null;
		var astNode;
		// Traverse up to the tree root while value is computable
		for (var j = stack.length; j--;) {
			astNode = stack[j];
			evaluateConsts(astNode, query);
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