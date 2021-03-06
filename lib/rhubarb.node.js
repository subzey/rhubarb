// A "magic object".
// If variable, property or function return value equals to this object,
// inline cannot be done
var UNCOMPUTABLE = {};

function _isPropname(memberExpression, identifier) {
	"use strict";
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

function _isObjectExpressionProperty(property, identifier) {
	"use strict";
	if (!property || property.type !== 'Property') {
		return false;
	}
	if (!identifier || identifier.type !== 'Identifier') {
		return false;
	}
	if (property.key !== identifier) {
		return false;
	}
	return true;
}

function _isAssignment(astStack) {
	"use strict";
	// TODO: Warn about mutability
	var prevNode = null;
	for (var i = astStack.length; i--;) {
		var node = astStack[i];
		if (!prevNode || node.type === 'MemberExpression' && node.object === prevNode) {
			prevNode = node;
			continue;
		}
		if (node.type === 'AssignmentExpression' && node.left === prevNode) {
			return true;
		}
		if (node.type === 'VariableDeclarator' && node.id === prevNode) {
			return true;
		}
		if (node.type === 'UpdateExpression' && node.argument === prevNode) {
			return true;
		}
	}
	return false;
}

function extractIdNodes(ast, scopeBehavior) {
	"use strict";
	var astStack = [];

	function detect(astNode, idNodes, scope) {
		astStack.push(astNode);
		var skipIteration = false;
		switch (astNode.type) {
			case 'FunctionDeclaration':
			case 'FunctionExpression':
			case 'ArrowFunctionExpression':
				var localScope = {
					'arguments': true
				};

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
					if (scopeBehavior !== 'flat') { // Do not check scopes at all
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
				if (_isPropname(astStack[astStack.length - 2], astNode)) {
					break;
				}
				if (_isAssignment(astStack)) {
					break;
				}
				if (_isObjectExpressionProperty(astStack[astStack.length - 2], astNode)) {
					break;
				}
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

	var filteredNodes = [];
	for (var i = 0; i < globalIdNodes.length; i++) {
		var varname = globalIdNodes[i].name;
		var isDeclared = Object.prototype.hasOwnProperty.call(globalScope, varname);
		if (scopeBehavior === 'undeclared' && isDeclared) {
			continue;
		}
		globalIdNodes[i].node.buildtimeCompute = true;
		filteredNodes.push(globalIdNodes[i]);
	}

	return filteredNodes;
}

function _calcUnaryExpression(unaryExpression) {
	"use strict";
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
	"use strict";
	if (!('buildtimeComputedValue' in logicalExpression.left)) {
		return;
	}
	var left = logicalExpression.left.buildtimeComputedValue;

	// Short circuit evaluation
	if (
		logicalExpression.operator === '&&' && !left ||
		logicalExpression.operator === '||' && left
	) {
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
	"use strict";
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


function _calcCall(callExpression) {
	"use strict";
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
		} else {
			return;
		}
	}
	try {
		var value = method.apply(base, args);
		if (value === UNCOMPUTABLE){
			return;
		}
		callExpression.buildtimeComputedValue = value;
	} catch (e) {}
}

function _calcIdentifier(identifier, query) {
	"use strict";
	if (!identifier.buildtimeCompute) {
		return;
	}
	var reference = [identifier.name];
	var result = query(reference.slice());
	if (!result) {
		return;
	}
	identifier.buildtimeComputedValue = result.value;
	if (!result.builtin){
		identifier.buildtimeReference = reference;
		identifier.buildtimeReplace = true;
	}
}

function _calcMember(memberExpression, query) {
	"use strict";
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
			// !!! Assume that if object is taken not from query(),
			// !!! it is not partial
			value = undefined;
		}
	}
	if (value === UNCOMPUTABLE){
		return;
	}
	memberExpression.buildtimeComputedValue = value;
}

function _calcExpressionStatement(expressionStatement) {
	"use strict";
	if (!expressionStatement.expression) {
		return;
	}
	if ('buildtimeComputedValue' in expressionStatement.expression) {
		expressionStatement.buildtimeComputedValue = expressionStatement.expression.buildtimeComputedValue;
	}
}

function _calcConditionalExpression(ternary) {
	"use strict";
	if (!('buildtimeComputedValue' in ternary.test)) {
		return;
	}
	var branch;
	if (ternary.test.buildtimeComputedValue) {
		branch = ternary.consequent;
	} else {
		branch = ternary.alternate;
	}
	if (!('buildtimeComputedValue' in branch)) {
		return;
	}
	ternary.buildtimeComputedValue = branch.buildtimeComputedValue;
}

function _calcLiteral(literal) {
	"use strict";
	if (literal.regexp) {
		literal.buildtimeComputedValue = new RegExp(literal.regexp.pattern, literal.regexp.flags);
	} else {
		literal.buildtimeComputedValue = literal.value;
	}
}

function _calcArrayExpression(arrayExpression) {
	"use strict";
	if (!arrayExpression.elements) {
		return;
	}
	var values = [];
	for (var i = 0; i < arrayExpression.elements.length; i++) {
		var element = arrayExpression.elements[i];
		if (!element) {
			continue;
		}
		if ('buildtimeComputedValue' in element) {
			values[i] = element.buildtimeComputedValue;
		} else {
			return;
		}
	}
	arrayExpression.buildtimeComputedValue = values;
}

function _calcObjectExpression(objectExpression) {
	"use strict";
	if (!objectExpression.properties) {
		return;
	}
	var dict = {};
	for (var i = 0; i < objectExpression.properties.length; i++) {
		var property = objectExpression.properties[i];
		if (!property) {
			continue;
		}
		var key;
		if (property.key.type === 'Identifier') {
			key = property.key.name;
		} else if (property.key.type === 'Literal') {
			key = property.key.value;
		} else {
			return;
		}
		if ('buildtimeComputedValue' in property.value) {
			dict[key] = property.value.buildtimeComputedValue;
		} else {
			return;
		}
	}
	objectExpression.buildtimeComputedValue = dict;
}

function evaluateConsts(astNode, query) {
	"use strict";
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
			_calcIdentifier(astNode, query);
			break;
		case 'MemberExpression':
			_calcMember(astNode, query);
			break;
		case 'Literal':
			_calcLiteral(astNode);
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
			_calcCall(astNode);
			break;
		case 'ExpressionStatement':
			_calcExpressionStatement(astNode);
			break;
		case 'ConditionalExpression':
			_calcConditionalExpression(astNode);
			break;
		case 'ArrayExpression':
			_calcArrayExpression(astNode);
			break;
		case 'ObjectExpression':
			_calcObjectExpression(astNode);
			break;
	}
	return;
}

function _serialize(value) {
	"use strict";
	if (typeof value === 'string') {
		return JSON.stringify(value);
	}
	// TODO: -0 ?
	return '' + value;
}

function replace(code, replacements) {
	"use strict";
	var right = 0;
	var chunks = [];

	replacements = replacements.slice().sort(function(a, b) {
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

function _normalizeOptions(dirtyOptions) {
	"use strict";
	var options = {
		'scope': 'global'
	};
	if (!dirtyOptions) {
		return options;
	}
	if (dirtyOptions.scope === 'undeclared' || dirtyOptions.scope === 'flat') {
		options.scope = dirtyOptions.scope;
	}
	return options;
}

var BUILTINS = [
	"NaN",
	"Infinity",
	"undefined",

	"isFinite",
	"isNaN",
	"parseFloat",
	"parseInt",

	"encodeURI",
	"decodeURI",
	"encodeURIComponent",
	"decodeURIComponent",
	"escape",
	"unescape",

	"Object",
	"Array",
	"Function",
	"Boolean",
	"Number",
	"String",
	"Symbol",
	"RegExp",


	"Error",
	"EvalError",
	"InternalError",
	"RangeError",
	"ReferenceError",
	"SyntaxError",
	"TypeError",
	"URIError",

	"Math",
	"JSON"
];

var SELF_REFERENCES = [
	'window',
	'global',
	'self'
];


function _queryTraverse(state, builtin) {
	"use strict";
	if (typeof state === 'function') {
		return state;
	}
	return function(path) {
		var root = state;
		for (var depth = 0; depth < path.length; depth++) {
			if (root == null) {
				return; // TypeError
			}
			if (!(path[depth] in Object(root))) {
				return; // Undeclared property
			}
			root = root[path[depth]];
			if (root === UNCOMPUTABLE){
				return; // Value is uncomputable
			}
		}
		return {
			'value': root,
			'builtin': builtin
		};
	};
}

function _makeQuery(state, builtins, selfReferences) {
	"use strict";
	var queryUserState = _queryTraverse(state, false);
	var queryBuiltins = _queryTraverse(builtins, true);

	return function query(path) {
		// Strip leading global references
		for (; path.length;) {
			if (selfReferences.indexOf(path[0]) === -1) {
				// Not a self reference
				break;
			}
			if (queryUserState([path[0]])) {
				// User query fn returns certain value
				break;
			}
			path = path.slice(1);
		}

		var result = queryUserState(path);
		if (result) {
			// Everything's okay, we have value
			return result;
		}
		// Do we have builin with that name?
		if (path[0] in builtins) {
			// First, query if user state shadows the builtin
			if (queryUserState[path[0]]) {
				// Yep, it's shadowed and we have nothing to traverse
				return;
			}
			return queryBuiltins(path);
		}
	};
}

function inline(code, state, options) {
	"use strict";
	var opts = _normalizeOptions(options);

	var builtins = {};
	for (var i = 0; i < BUILTINS.length; i++) {
		builtins[BUILTINS[i]] = global[BUILTINS[i]];
	}
	var selfReferences = SELF_REFERENCES;
	var query = _makeQuery(state, builtins, selfReferences);

	var ast = require('esprima').parse(code, {
		range: true
	});

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
			if (Array.isArray(astNode)) {
				// Not a node actually
				continue;
			}
			evaluateConsts(astNode, query);
			if (!('buildtimeComputedValue' in astNode)) {
				break;
			}
			if (Object(astNode.buildtimeComputedValue) === astNode.buildtimeComputedValue) {
				continue;
			}
			if (astNode.type === 'Identifier' && !astNode.buildtimeReplace) {
				continue;
			}
			modifiedNode = astNode;
		}
		if (!modifiedNode) {
			// There's nothing we can replace
			continue;
		}
		// Special case: expression is wrapped into if statement

		replacements.push({
			'start': modifiedNode.range[0],
			'end': modifiedNode.range[1],
			'value': _serialize(modifiedNode.buildtimeComputedValue)
		});

	}

	return replace(code, replacements);
}

module.exports.inline = inline;
module.exports.UNCOMPUTABLE = UNCOMPUTABLE;