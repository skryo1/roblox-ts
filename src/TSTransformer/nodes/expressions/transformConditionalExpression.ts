import luau from "LuauAST";
import { TransformState } from "TSTransformer";
import { transformExpression } from "TSTransformer/nodes/expressions/transformExpression";
import { createTruthinessChecks } from "TSTransformer/util/createTruthinessChecks";
import { isBooleanLiteralType, isPossiblyType, isUndefinedType } from "TSTransformer/util/types";
import ts from "typescript";

export function transformConditionalExpression(state: TransformState, node: ts.ConditionalExpression) {
	const condition = transformExpression(state, node.condition);
	const [whenTrue, whenTruePrereqs] = state.capture(() => transformExpression(state, node.whenTrue));
	const [whenFalse, whenFalsePrereqs] = state.capture(() => transformExpression(state, node.whenFalse));
	const type = state.getType(node.whenTrue);
	if (
		!isPossiblyType(type, isBooleanLiteralType(state, false)) &&
		!isPossiblyType(type, isUndefinedType) &&
		luau.list.isEmpty(whenTruePrereqs) &&
		luau.list.isEmpty(whenFalsePrereqs)
	) {
		return luau.binary(
			luau.binary(
				createTruthinessChecks(state, condition, node.condition, state.getType(node.condition)),
				"and",
				whenTrue,
			),
			"or",
			whenFalse,
		);
	}

	const tempId = luau.tempId("result");
	state.prereq(
		luau.create(luau.SyntaxKind.VariableDeclaration, {
			left: tempId,
			right: undefined,
		}),
	);

	luau.list.push(
		whenTruePrereqs,
		luau.create(luau.SyntaxKind.Assignment, {
			left: tempId,
			operator: "=",
			right: whenTrue,
		}),
	);
	luau.list.push(
		whenFalsePrereqs,
		luau.create(luau.SyntaxKind.Assignment, {
			left: tempId,
			operator: "=",
			right: whenFalse,
		}),
	);

	state.prereq(
		luau.create(luau.SyntaxKind.IfStatement, {
			condition,
			statements: whenTruePrereqs,
			elseBody: whenFalsePrereqs,
		}),
	);

	return tempId;
}
