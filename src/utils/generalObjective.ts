import type { TaskCandidate, TaskResults } from "../types/api";

export type GeneralVariableDomain = "binary" | "spin";
export type GeneralObjectiveSense = "minimize" | "maximize";
export type GeneralMatrixObjectiveKind = "quadratic" | "maxcut";
export type GeneralConstraintOperator = "<=" | "==" | ">=";

export interface GeneralConstraintInput {
  coefficients: string;
  operator: GeneralConstraintOperator;
  rhs: string | number;
  penalty: number;
}

export interface GeneralInputSnapshot {
  source: "expression" | "matrix";
  expressionForm: "scalar" | "vector";
  variables: string[];
  slackVariables: string[];
  domain: GeneralVariableDomain;
  sense: GeneralObjectiveSense;
  expression: string;
  matrixObjective: {
    kind: GeneralMatrixObjectiveKind;
    weightMatrix: string;
    linearVector: string;
    constant: string;
  };
  constraints: GeneralConstraintInput[];
}

export const isGeneralInputSnapshot = (value: unknown): value is GeneralInputSnapshot => {
  if (!value || typeof value !== "object") return false;
  const input = value as Partial<GeneralInputSnapshot>;
  const matrixObjective = input.matrixObjective as Partial<GeneralInputSnapshot["matrixObjective"]> | undefined;
  return (
    ["expression", "matrix"].includes(String(input.source))
    && ["scalar", "vector"].includes(String(input.expressionForm))
    && Array.isArray(input.variables) && input.variables.every((name) => typeof name === "string")
    && Array.isArray(input.slackVariables) && input.slackVariables.every((name) => typeof name === "string")
    && ["binary", "spin"].includes(String(input.domain))
    && ["minimize", "maximize"].includes(String(input.sense))
    && typeof input.expression === "string"
    && Boolean(matrixObjective)
    && ["quadratic", "maxcut"].includes(String(matrixObjective?.kind))
    && typeof matrixObjective?.weightMatrix === "string"
    && typeof matrixObjective?.linearVector === "string"
    && typeof matrixObjective?.constant === "string"
    && Array.isArray(input.constraints)
  );
};

export const extractGeneralInputSnapshot = (value: unknown): GeneralInputSnapshot | null => {
  if (!value || typeof value !== "object") return null;
  const snapshot = (value as { generalInput?: unknown }).generalInput;
  return isGeneralInputSnapshot(snapshot) ? snapshot : null;
};

type Polynomial = Map<string, number>;

interface Token {
  type: "number" | "identifier" | "operator" | "eof";
  value: string;
}

const cleanNumber = (value: number) => {
  if (Math.abs(value) <= 1e-12 || Object.is(value, -0)) return 0;
  return value;
};

const constantPolynomial = (value: number): Polynomial => new Map([["", value]]);

const cleanPolynomial = (polynomial: Polynomial) => {
  for (const [key, value] of polynomial) {
    if (Math.abs(value) <= 1e-12) polynomial.delete(key);
  }
  return polynomial;
};

const addPolynomials = (left: Polynomial, right: Polynomial, scale = 1) => {
  const result = new Map(left);
  for (const [key, value] of right) result.set(key, (result.get(key) || 0) + scale * value);
  return cleanPolynomial(result);
};

const scalePolynomial = (polynomial: Polynomial, scale: number) =>
  cleanPolynomial(new Map(Array.from(polynomial, ([key, value]) => [key, value * scale])));

const normalizeMonomial = (items: number[], domain: GeneralVariableDomain) => {
  if (domain === "binary") return Array.from(new Set(items)).sort((a, b) => a - b);
  const counts = new Map<number, number>();
  for (const item of items) counts.set(item, (counts.get(item) || 0) + 1);
  return Array.from(counts).filter(([, count]) => count % 2 === 1).map(([item]) => item).sort((a, b) => a - b);
};

const multiplyPolynomials = (left: Polynomial, right: Polynomial, domain: GeneralVariableDomain) => {
  const result: Polynomial = new Map();
  for (const [leftKey, leftValue] of left) {
    for (const [rightKey, rightValue] of right) {
      const items = [...(leftKey ? leftKey.split(",").map(Number) : []), ...(rightKey ? rightKey.split(",").map(Number) : [])];
      const normalized = normalizeMonomial(items, domain);
      if (normalized.length > 2) throw new Error("表达式展开后超过二次，不能转换为QUBO矩阵");
      const key = normalized.join(",");
      result.set(key, (result.get(key) || 0) + leftValue * rightValue);
    }
  }
  return cleanPolynomial(result);
};

const tokenize = (source: string): Token[] => {
  const tokens: Token[] = [];
  let index = 0;
  while (index < source.length) {
    const rest = source.slice(index);
    const whitespace = rest.match(/^\s+/);
    if (whitespace) {
      index += whitespace[0].length;
      continue;
    }
    const number = rest.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i);
    if (number) {
      tokens.push({ type: "number", value: number[0] });
      index += number[0].length;
      continue;
    }
    const identifier = rest.match(/^[A-Za-z_]\w*/);
    if (identifier) {
      tokens.push({ type: "identifier", value: identifier[0] });
      index += identifier[0].length;
      continue;
    }
    const operator = rest.startsWith("**") ? "**" : rest[0];
    if (["+", "-", "*", "/", "**", "^", "(", ")"].includes(operator)) {
      tokens.push({ type: "operator", value: operator });
      index += operator.length;
      continue;
    }
    throw new Error(`表达式包含不支持的字符：${rest[0]}`);
  }
  tokens.push({ type: "eof", value: "" });
  return tokens;
};

class PolynomialParser {
  private readonly tokens: Token[];
  private readonly variables: Map<string, number>;
  private readonly domain: GeneralVariableDomain;
  private position = 0;

  constructor(source: string, variableNames: string[], domain: GeneralVariableDomain) {
    this.tokens = tokenize(source);
    this.variables = new Map(variableNames.map((name, index) => [name, index]));
    this.domain = domain;
  }

  parse() {
    const result = this.parseExpression();
    if (this.current().type !== "eof") throw new Error(`表达式语法错误：无法识别 ${this.current().value}`);
    return result;
  }

  private current() {
    return this.tokens[this.position];
  }

  private consume(value?: string) {
    const token = this.current();
    if (value && token.value !== value) throw new Error(`表达式语法错误：应为 ${value}`);
    this.position += 1;
    return token;
  }

  private parseExpression(): Polynomial {
    let result = this.parseTerm();
    while (["+", "-"].includes(this.current().value)) {
      const operator = this.consume().value;
      result = addPolynomials(result, this.parseTerm(), operator === "+" ? 1 : -1);
    }
    return result;
  }

  private parseTerm(): Polynomial {
    let result = this.parseUnary();
    while (["*", "/"].includes(this.current().value)) {
      const operator = this.consume().value;
      const right = this.parseUnary();
      if (operator === "*") {
        result = multiplyPolynomials(result, right, this.domain);
      } else {
        if (right.size !== 1 || !right.has("")) throw new Error("除数必须是非零常数");
        const divisor = right.get("")!;
        if (Math.abs(divisor) <= 1e-12) throw new Error("除数不能为0");
        result = scalePolynomial(result, 1 / divisor);
      }
    }
    return result;
  }

  private parsePower(): Polynomial {
    let result = this.parsePrimary();
    if (["**", "^"].includes(this.current().value)) {
      this.consume();
      const exponentPolynomial = this.parseUnary();
      if (exponentPolynomial.size !== 1 || !exponentPolynomial.has("")) throw new Error("指数必须是0、1或2");
      const exponent = exponentPolynomial.get("")!;
      if (![0, 1, 2].includes(exponent)) throw new Error("只支持0、1、2次幂");
      if (exponent === 0) result = constantPolynomial(1);
      if (exponent === 2) result = multiplyPolynomials(result, result, this.domain);
    }
    return result;
  }

  private parseUnary(): Polynomial {
    if (this.current().value === "+") {
      this.consume("+");
      return this.parseUnary();
    }
    if (this.current().value === "-") {
      this.consume("-");
      return scalePolynomial(this.parseUnary(), -1);
    }
    return this.parsePower();
  }

  private parsePrimary(): Polynomial {
    const token = this.current();
    if (token.type === "number") {
      this.consume();
      return constantPolynomial(Number(token.value));
    }
    if (token.type === "identifier") {
      this.consume();
      const variableIndex = this.variables.get(token.value);
      if (variableIndex === undefined) throw new Error(`未定义变量：${token.value}`);
      return new Map([[String(variableIndex), 1]]);
    }
    if (token.value === "(") {
      this.consume("(");
      const result = this.parseExpression();
      this.consume(")");
      return result;
    }
    throw new Error("表达式语法错误：缺少数字、变量或括号表达式");
  }
}

const polynomialToQubo = (polynomial: Polynomial, size: number, domain: GeneralVariableDomain, sense: GeneralObjectiveSense) => {
  const matrix = Array.from({ length: size }, () => Array(size).fill(0));
  const senseScale = sense === "maximize" ? -1 : 1;
  for (const [key, rawCoefficient] of polynomial) {
    if (!key) continue;
    const variables = key.split(",").map(Number);
    const coefficient = rawCoefficient * senseScale;
    if (variables.length === 1) {
      matrix[variables[0]][variables[0]] += domain === "spin" ? 2 * coefficient : coefficient;
      continue;
    }
    const [left, right] = variables;
    if (domain === "spin") {
      matrix[left][left] -= 2 * coefficient;
      matrix[right][right] -= 2 * coefficient;
      matrix[left][right] += 2 * coefficient;
      matrix[right][left] += 2 * coefficient;
    } else {
      matrix[left][right] += coefficient / 2;
      matrix[right][left] += coefficient / 2;
    }
  }
  return matrix.map((row) => row.map(cleanNumber));
};

const stripAssignment = (source: string, names: string[]) => {
  const pattern = new RegExp(`^\\s*(?:${names.join("|")})\\s*=`, "i");
  return source.replace(pattern, "").trim();
};

export const parseGeneralMatrix = (source: string, size: number) => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripAssignment(source, ["W", "Q"]));
  } catch {
    throw new Error("权重矩阵 W 格式不正确，请使用 JSON 二维数字数组");
  }
  if (!Array.isArray(parsed) || parsed.length !== size || parsed.some((row) => !Array.isArray(row) || row.length !== size)) {
    throw new Error(`权重矩阵 W 必须是 ${size} × ${size} 方阵`);
  }
  return (parsed as unknown[][]).map((row) => row.map((value) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error("权重矩阵 W 只能包含有限数字");
    }
    return value;
  }));
};

export const parseGeneralVector = (
  source: string,
  size: number,
  fieldLabel = "线性向量 c",
) => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripAssignment(source, ["c"]));
  } catch {
    throw new Error(`${fieldLabel}格式不正确，请使用 JSON 数字数组`);
  }
  if (!Array.isArray(parsed) || parsed.length !== size) throw new Error(`${fieldLabel}必须包含 ${size} 个元素`);
  return parsed.map((value) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`${fieldLabel}只能包含有限数字`);
    }
    return value;
  });
};

export const parseGeneralConstant = (source: string) => {
  const value = Number(stripAssignment(source, ["k"]));
  if (!Number.isFinite(value)) throw new Error("常数 k 必须是有限数字");
  return value;
};

export const convertScalarObjectiveToQubo = (options: {
  expression: string;
  variableNames: string[];
  domain: GeneralVariableDomain;
  sense: GeneralObjectiveSense;
}) => {
  if (!options.expression.trim()) throw new Error("请输入标量目标函数");
  const polynomial = new PolynomialParser(options.expression, options.variableNames, options.domain).parse();
  return polynomialToQubo(polynomial, options.variableNames.length, options.domain, options.sense);
};

export const convertMatrixObjectiveToQubo = (options: {
  weightMatrix: number[][];
  linearVector: number[];
  domain: GeneralVariableDomain;
  sense: GeneralObjectiveSense;
  kind: GeneralMatrixObjectiveKind;
}) => {
  const size = options.weightMatrix.length;
  const matrix = Array.from({ length: size }, () => Array(size).fill(0));
  if (options.kind === "maxcut") {
    for (let index = 0; index < size; index += 1) {
      matrix[index][index] += options.linearVector[index];
    }
    for (let left = 0; left < size; left += 1) {
      for (let right = left + 1; right < size; right += 1) {
        const weight = (options.weightMatrix[left][right] + options.weightMatrix[right][left]) / 2;
        matrix[left][left] += weight;
        matrix[right][right] += weight;
        matrix[left][right] -= weight;
        matrix[right][left] -= weight;
      }
    }
  } else if (options.domain === "binary") {
    for (let index = 0; index < size; index += 1) {
      matrix[index][index] = options.weightMatrix[index][index] + options.linearVector[index];
    }
    for (let left = 0; left < size; left += 1) {
      for (let right = left + 1; right < size; right += 1) {
        const coefficient = (options.weightMatrix[left][right] + options.weightMatrix[right][left]) / 2;
        matrix[left][right] = coefficient;
        matrix[right][left] = coefficient;
      }
    }
  } else {
    for (let index = 0; index < size; index += 1) matrix[index][index] += 2 * options.linearVector[index];
    for (let left = 0; left < size; left += 1) {
      for (let right = left + 1; right < size; right += 1) {
        const coefficient = options.weightMatrix[left][right] + options.weightMatrix[right][left];
        matrix[left][left] -= 2 * coefficient;
        matrix[right][right] -= 2 * coefficient;
        matrix[left][right] += 2 * coefficient;
        matrix[right][left] += 2 * coefficient;
      }
    }
  }
  const senseScale = options.sense === "maximize" ? -1 : 1;
  return matrix.map((row) => row.map((value) => cleanNumber(value * senseScale)));
};

const parseScalarLinearExpression = (
  source: string,
  variableNames: string[],
  domain: GeneralVariableDomain,
  label: string,
) => {
  if (!source.trim()) throw new Error(`${label}不能为空`);
  const polynomial = new PolynomialParser(source, variableNames, domain).parse();
  const coefficients = Array(variableNames.length).fill(0) as number[];
  let constant = 0;
  for (const [key, value] of polynomial) {
    if (!key) {
      constant += value;
      continue;
    }
    const variables = key.split(",");
    if (variables.length !== 1) throw new Error("约束必须是线性表达式");
    coefficients[Number(variables[0])] += value;
  }
  return { constant, coefficients };
};

const parseConstantExpression = (source: string, label: string) => {
  const parsed = parseScalarLinearExpression(source || "0", [], "binary", label);
  return parsed.constant;
};

const parseConstraintEquation = (
  lhsSource: string,
  rhsSource: string,
  variableNames: string[],
  expressionForm: "scalar" | "vector",
  domain: GeneralVariableDomain,
  label: string,
) => {
  let constant: number;
  let coefficients: number[];

  if (expressionForm === "vector") {
    coefficients = parseGeneralVector(
      lhsSource,
      variableNames.length,
      `${label}的系数向量`,
    );
    constant = -parseConstantExpression(rhsSource, `${label}的右端`);
  } else {
    const lhs = parseScalarLinearExpression(lhsSource, variableNames, domain, `${label}的左端`);
    const rhs = parseScalarLinearExpression(rhsSource || "0", variableNames, domain, `${label}的右端`);
    constant = lhs.constant - rhs.constant;
    coefficients = lhs.coefficients.map((coefficient, index) => coefficient - rhs.coefficients[index]);
  }

  // The submitted QUBO always uses binary variables. Convert constraints entered
  // in the spin domain with s = 2q - 1 before adding penalty/slack terms.
  if (domain === "spin") {
    constant -= coefficients.reduce((sum, coefficient) => sum + coefficient, 0);
    coefficients = coefficients.map((coefficient) => 2 * coefficient);
  }

  return { constant, coefficients };
};

const bigintAbs = (value: bigint) => value < 0n ? -value : value;

const bigintGcd = (left: bigint, right: bigint) => {
  let a = bigintAbs(left);
  let b = bigintAbs(right);
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
};

const reduceFraction = (numerator: bigint, denominator: bigint) => {
  const divisor = bigintGcd(numerator, denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor };
};

const decimalFraction = (value: number) => {
  const fixed = value.toFixed(12);
  const negative = fixed.startsWith("-");
  const unsigned = negative ? fixed.slice(1) : fixed;
  const [integerPart, decimalPart = ""] = unsigned.split(".");
  const denominator = 10n ** BigInt(decimalPart.length);
  const numerator = BigInt(integerPart + decimalPart) * (negative ? -1n : 1n);
  return reduceFraction(numerator, denominator);
};

const limitFractionDenominator = (value: number, maximumDenominator = 1000) => {
  const original = decimalFraction(value);
  const limit = BigInt(maximumDenominator);
  if (original.denominator <= limit) return original;

  let numerator = bigintAbs(original.numerator);
  let denominator = original.denominator;
  let p0 = 0n;
  let q0 = 1n;
  let p1 = 1n;
  let q1 = 0n;
  while (true) {
    const quotient = numerator / denominator;
    const q2 = q0 + quotient * q1;
    if (q2 > limit) break;
    [p0, q0, p1, q1] = [p1, q1, p0 + quotient * p1, q2];
    [numerator, denominator] = [denominator, numerator - quotient * denominator];
  }
  const multiplier = (limit - q0) / q1;
  const lower = { numerator: p0 + multiplier * p1, denominator: q0 + multiplier * q1 };
  const upper = { numerator: p1, denominator: q1 };
  const originalNumerator = bigintAbs(original.numerator);
  const lowerDistance = bigintAbs(lower.numerator * original.denominator - originalNumerator * lower.denominator);
  const upperDistance = bigintAbs(upper.numerator * original.denominator - originalNumerator * upper.denominator);
  const chooseUpper = upperDistance * lower.denominator <= lowerDistance * upper.denominator;
  const selected = chooseUpper ? upper : lower;
  return {
    numerator: original.numerator < 0n ? -selected.numerator : selected.numerator,
    denominator: selected.denominator,
  };
};

const getIntegerScale = (values: number[]) => {
  let scale = 1;
  for (const value of values) {
    const denominator = Number(limitFractionDenominator(value).denominator);
    scale = Math.abs(scale * denominator) / Number(bigintGcd(BigInt(scale), BigInt(denominator)));
    if (scale > 1000) {
      throw new Error("不等式系数的小数精度过高，请将系数缩放为整数或简单分数");
    }
  }
  return scale;
};

const buildBinarySlackWeights = (maximum: number) => {
  const weights: number[] = [];
  for (let weight = 1; weight <= maximum; weight *= 2) {
    weights.push(weight);
  }
  return weights;
};

const expandSquareMatrix = (matrix: number[][], size: number) => {
  for (const row of matrix) {
    while (row.length < size) row.push(0);
  }
  while (matrix.length < size) matrix.push(Array(size).fill(0));
};

const addSquaredPenalty = (
  matrix: number[][],
  constant: number,
  terms: Array<[number, number]>,
  penalty: number,
) => {
  for (let leftIndex = 0; leftIndex < terms.length; leftIndex += 1) {
    const [leftVariable, leftCoefficient] = terms[leftIndex];
    matrix[leftVariable][leftVariable] += penalty * (
      leftCoefficient * leftCoefficient + 2 * constant * leftCoefficient
    );
    for (let rightIndex = leftIndex + 1; rightIndex < terms.length; rightIndex += 1) {
      const [rightVariable, rightCoefficient] = terms[rightIndex];
      const coefficient = penalty * leftCoefficient * rightCoefficient;
      matrix[leftVariable][rightVariable] += coefficient;
      matrix[rightVariable][leftVariable] += coefficient;
    }
  }
};

export const applyGeneralConstraintsToQubo = (options: {
  matrix: number[][];
  constraints: GeneralConstraintInput[];
  variableNames: string[];
  expressionForm: "scalar" | "vector";
  domain: GeneralVariableDomain;
  maxSize?: number;
}) => {
  const originalSize = options.variableNames.length;
  if (
    options.matrix.length !== originalSize
    || options.matrix.some((row) => row.length !== originalSize)
  ) {
    throw new Error("目标函数 QUBO 规模与变量数量不一致");
  }

  const matrix = options.matrix.map((row) => row.map(Number));
  const slackVariableNames: string[] = [];
  const maxSize = options.maxSize ?? 10;

  const reservedVariableNames = new Set(options.variableNames);
  options.constraints.forEach((constraint, constraintIndex) => {
    if (!constraint.coefficients.trim()) return;
    const label = `第 ${constraintIndex + 1} 条约束`;
    const penalty = Number(constraint.penalty);
    if (!Number.isFinite(penalty) || penalty <= 0) throw new Error(`${label}的惩罚系数必须大于 0`);
    if (!["<=", ">=", "=="].includes(constraint.operator)) {
      throw new Error(`${label}的关系必须是 <=、>= 或 ==`);
    }
    const rhsSource = typeof constraint.rhs === "string"
      ? constraint.rhs.trim() || "0"
      : String(constraint.rhs);

    const parsed = parseConstraintEquation(
      constraint.coefficients,
      rhsSource,
      options.variableNames,
      options.expressionForm,
      options.domain,
      label,
    );
    if (!Number.isFinite(parsed.constant) || parsed.coefficients.some((value) => !Number.isFinite(value))) {
      throw new Error(`${label}的系数必须是有限数字`);
    }

    let constant = parsed.constant;
    let coefficients = parsed.coefficients;
    const slackTerms: Array<[number, number]> = [];

    if (constraint.operator !== "==") {
      const scale = getIntegerScale([constant, ...coefficients]);
      constant = Math.round(constant * scale);
      coefficients = coefficients.map((value) => Math.round(value * scale));

      const minimum = constant + coefficients.reduce((sum, value) => sum + Math.min(0, value), 0);
      const maximum = constant + coefficients.reduce((sum, value) => sum + Math.max(0, value), 0);
      const slackMaximum = constraint.operator === "<=" ? -minimum : maximum;
      const isInfeasible = constraint.operator === "<=" ? minimum > 1e-9 : maximum < -1e-9;
      if (isInfeasible) throw new Error(`${label}在 0/1 变量域内不可满足`);

      const direction = constraint.operator === "<=" ? 1 : -1;
      for (const weight of buildBinarySlackWeights(Math.round(Math.max(0, slackMaximum)))) {
        const variableIndex = matrix.length;
        if (variableIndex >= maxSize) {
          throw new Error(`加入约束松弛变量后超过 ${maxSize} 个 QUBO 变量，请减少问题规模或约束范围`);
        }
        expandSquareMatrix(matrix, variableIndex + 1);
        const slackName = `slack_c${constraintIndex + 1}_b${slackTerms.length}`;
        if (reservedVariableNames.has(slackName)) {
          throw new Error(`自动松弛变量名冲突：${slackName}`);
        }
        reservedVariableNames.add(slackName);
        slackTerms.push([variableIndex, direction * weight]);
        slackVariableNames.push(slackName);
      }
    }

    const terms: Array<[number, number]> = coefficients
      .map((coefficient, variableIndex) => [variableIndex, coefficient] as [number, number])
      .filter(([, coefficient]) => Math.abs(coefficient) > 1e-12);
    terms.push(...slackTerms);
    addSquaredPenalty(matrix, constant, terms, penalty);
  });

  return {
    matrix: matrix.map((row) => row.map(cleanNumber)),
    slackVariableNames,
  };
};

const evaluatePolynomial = (polynomial: Polynomial, values: number[]) => {
  let result = 0;
  for (const [key, coefficient] of polynomial) {
    if (!key) {
      result += coefficient;
      continue;
    }
    const product = key
      .split(",")
      .map(Number)
      .reduce((value, variableIndex) => value * values[variableIndex], 1);
    result += coefficient * product;
  }
  return cleanNumber(result);
};

const buildOriginalObjectiveEvaluator = (input: GeneralInputSnapshot) => {
  if (input.expressionForm === "scalar") {
    const polynomial = new PolynomialParser(
      input.expression,
      input.variables,
      input.domain,
    ).parse();
    return (domainValues: number[]) => evaluatePolynomial(polynomial, domainValues);
  }

  const size = input.variables.length;
  const weightMatrix = parseGeneralMatrix(input.matrixObjective.weightMatrix, size);
  const linearVector = parseGeneralVector(input.matrixObjective.linearVector, size);
  const constant = parseGeneralConstant(input.matrixObjective.constant);
  if (input.matrixObjective.kind === "maxcut") {
    return (domainValues: number[]) => {
      let result = constant;
      const linearValues = input.domain === "spin"
        ? domainValues.map((value) => (value + 1) / 2)
        : domainValues;
      for (let index = 0; index < size; index += 1) {
        result += linearVector[index] * linearValues[index];
      }
      for (let left = 0; left < size; left += 1) {
        for (let right = left + 1; right < size; right += 1) {
          if (domainValues[left] !== domainValues[right]) {
            result += (weightMatrix[left][right] + weightMatrix[right][left]) / 2;
          }
        }
      }
      return cleanNumber(result);
    };
  }

  return (domainValues: number[]) => {
    let result = constant;
    for (let row = 0; row < size; row += 1) {
      result += linearVector[row] * domainValues[row];
      for (let column = 0; column < size; column += 1) {
        result += domainValues[row] * weightMatrix[row][column] * domainValues[column];
      }
    }
    return cleanNumber(result);
  };
};

export const restoreGeneralTaskResults = (
  results: TaskResults,
  input: GeneralInputSnapshot,
): TaskResults => {
  if (input.source !== "expression" || !Array.isArray(results.candidates)) {
    return results;
  }

  const withoutUnrestoredValue = (candidate: TaskCandidate): TaskCandidate => ({
    ...candidate,
    rawValue: candidate.value,
    rawSolution: candidate.solution,
    value: null,
  });
  let evaluateObjective: (domainValues: number[]) => number;
  try {
    evaluateObjective = buildOriginalObjectiveEvaluator(input);
  } catch {
    // generalInput 只是用于恢复展示语义的辅助快照。旧数据或外部客户端
    // 写入的快照即使不完整，也不能把 QUBO 能量显示成原始目标值。
    return {
      ...results,
      candidates: results.candidates.map(withoutUnrestoredValue),
    };
  }
  const originalSize = input.variables.length;
  const candidates = results.candidates.map((candidate): TaskCandidate => {
    if (!Array.isArray(candidate.solution) || candidate.solution.length < originalSize) {
      return withoutUnrestoredValue(candidate);
    }
    const rawValues = candidate.solution.slice(0, originalSize).map(Number);
    if (rawValues.some((value) => !Number.isFinite(value) || (value !== 0 && value !== 1))) {
      return withoutUnrestoredValue(candidate);
    }
    const domainValues = input.domain === "spin"
      ? rawValues.map((value) => 2 * value - 1)
      : rawValues;
    try {
      return {
        ...candidate,
        rawValue: candidate.value,
        rawSolution: candidate.solution,
        value: evaluateObjective(domainValues),
        solution: domainValues,
      };
    } catch {
      return withoutUnrestoredValue(candidate);
    }
  });

  return { ...results, candidates };
};

export const formatGeneralMatrix = (matrix: number[][], name = "W") => {
  const rows = matrix.map((row) => `  [${row.join(", ")}]`);
  return `${name} = [${rows.length ? `\n${rows.join(",\n")}\n` : ""}]`;
};

export const formatGeneralVector = (size: number) => `c = [${Array(size).fill(0).join(",")}]`;
